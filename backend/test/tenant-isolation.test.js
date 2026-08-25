const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { app } = require("../src/server");
const { connectTestDb, disconnectTestDb } = require("./helpers/db");

test.before(async () => {
  await connectTestDb();
});

test.after(async () => {
  await disconnectTestDb();
});

async function signup(collegeName, email) {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({
      collegeName,
      name: `${collegeName} Owner`,
      email,
      password: "Passw0rd!234",
    })
    .expect(201);

  assert.ok(response.body.token);
  return response.body;
}

test("Tenant A cannot fetch Tenant B timetable with Tenant A token", async () => {
  const tenantA = await signup("Tenant A College", "owner-a@example.edu");
  const tenantB = await signup("Tenant B College", "owner-b@example.edu");

  const created = await request(app)
    .post("/api/timetables")
    .set("Authorization", `Bearer ${tenantB.token}`)
    .send({
      name: "Tenant B private timetable",
      createdBy: tenantB.user.id,
      parsed: { campusName: "Tenant B" },
      schedule: { assignments: [] },
    })
    .expect(201);

  await request(app)
    .get(`/api/timetables/${created.body.data._id}`)
    .set("Authorization", `Bearer ${tenantA.token}`)
    .expect(404);

  const sameTenantRead = await request(app)
    .get(`/api/timetables/${created.body.data._id}`)
    .set("Authorization", `Bearer ${tenantB.token}`)
    .expect(200);

  assert.equal(sameTenantRead.body.data.name, "Tenant B private timetable");
});
