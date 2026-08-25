/**
 * RBAC + usage-metering regression tests.
 *
 * Covers the security rules that make ScheduleAI a real multi-tenant SaaS:
 *   1. Business endpoints reject unauthenticated requests (401).
 *   2. Institution owners can generate timetables (owner + admin roles).
 *   3. Faculty (read-only role) is blocked from writing resources (403).
 *   4. Free-plan tenants are cut off after their monthly generation quota
 *      with an upgrade hint in the 403 payload.
 */
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

async function signup(collegeName, email, plan = "free") {
  const response = await request(app)
    .post("/api/auth/signup")
    .send({
      collegeName,
      name: `${collegeName} Owner`,
      email,
      password: "Passw0rd!234",
      plan,
    })
    .expect(201);

  return response.body;
}

test("Unauthenticated requests to business endpoints are rejected with 401", async () => {
  await request(app).post("/api/schedule").send({}).expect(401);
  await request(app).post("/api/timetables").send({}).expect(401);
  await request(app).post("/api/optimize/apply").send({}).expect(401);
});

test("Owner can generate timetables and faculty is read-only", async () => {
  const tenant = await signup("RBAC College", "owner@rbac.test");

  // The institution owner must be allowed to generate (regression: earlier the
  // route only accepted the literal "admin" role, locking owners out).
  const generated = await request(app)
    .post("/api/schedule")
    .set("Authorization", `Bearer ${tenant.token}`)
    .send({})
    .expect(200);

  assert.ok(generated.body.schedule.assignments.length > 0, "Solver should place demo classes");

  // Invite a faculty member and accept the invitation.
  const invite = await request(app)
    .post("/api/auth/invitations")
    .set("Authorization", `Bearer ${tenant.token}`)
    .send({ email: "teacher@rbac.test", role: "faculty" })
    .expect(201);

  const accepted = await request(app)
    .post("/api/auth/invitations/accept")
    .send({
      token: invite.body.invitation.token,
      name: "Faculty Member",
      password: "Passw0rd!234",
    })
    .expect(201);

  assert.equal(accepted.body.user.role, "faculty");

  // Faculty can read resources...
  await request(app)
    .get("/api/faculties")
    .set("Authorization", `Bearer ${accepted.body.token}`)
    .expect(200);

  // ...but cannot create timetables or other resources.
  await request(app)
    .post("/api/timetables")
    .set("Authorization", `Bearer ${accepted.body.token}`)
    .send({ name: "Sneaky timetable" })
    .expect(403);

  await request(app)
    .post("/api/schedule")
    .set("Authorization", `Bearer ${accepted.body.token}`)
    .send({})
    .expect(403);
});

test("Free plan is limited to 3 timetable generations per month", async () => {
  const tenant = await signup("Quota College", "owner@quota.test");

  for (let i = 1; i <= 3; i++) {
    await request(app)
      .post("/api/schedule")
      .set("Authorization", `Bearer ${tenant.token}`)
      .send({})
      .expect(200);
  }

  const blocked = await request(app)
    .post("/api/schedule")
    .set("Authorization", `Bearer ${tenant.token}`)
    .send({})
    .expect(403);

  assert.equal(blocked.body.canUpgrade, true);
  assert.equal(blocked.body.usage.used, 3);
  assert.equal(blocked.body.usage.limit, 3);
});
