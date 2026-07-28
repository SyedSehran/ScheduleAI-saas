const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const request = require("supertest");
const { app } = require("../src/server");

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/scheduleai_tenant_isolation_test";

test.before(async () => {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.dropDatabase();
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
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
