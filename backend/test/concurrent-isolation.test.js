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

  return response.body;
}

test("Concurrent cross-tenant isolation and load benchmark (30 simultaneous requests)", async () => {
  const tenantA = await signup("Alpha University", "admin@alpha.edu");
  const tenantB = await signup("Beta Institute", "admin@beta.edu");

  // Create seed resources under Tenant B
  const seedRes = await request(app)
    .post("/api/timetables")
    .set("Authorization", `Bearer ${tenantB.token}`)
    .send({
      name: "Beta Confidential Schedule",
      createdBy: tenantB.user.id,
      parsed: { campusName: "Beta Campus" },
      schedule: { assignments: [] },
    })
    .expect(201);

  const betaTimetableId = seedRes.body.data._id;

  const TOTAL_REQUESTS = 30;
  const requests = [];
  const startTime = Date.now();

  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const isTenantA = i % 2 === 0;
    const token = isTenantA ? tenantA.token : tenantB.token;

    if (isTenantA) {
      // Tenant A attempts cross-tenant access to Tenant B's timetable
      requests.push(
        request(app)
          .get(`/api/timetables/${betaTimetableId}`)
          .set("Authorization", `Bearer ${token}`)
          .then((res) => ({ tenant: "A", expectedStatus: 404, actualStatus: res.status, body: res.body })),
      );
    } else {
      // Tenant B fetches its own timetable
      requests.push(
        request(app)
          .get(`/api/timetables/${betaTimetableId}`)
          .set("Authorization", `Bearer ${token}`)
          .then((res) => ({ tenant: "B", expectedStatus: 200, actualStatus: res.status, body: res.body })),
      );
    }
  }

  const results = await Promise.all(requests);
  const totalDuration = Date.now() - startTime;
  const avgLatency = (totalDuration / TOTAL_REQUESTS).toFixed(2);

  let zeroLeakCount = 0;
  const statusCounts = {};

  results.forEach((r) => {
    statusCounts[r.actualStatus] = (statusCounts[r.actualStatus] || 0) + 1;
    if (r.tenant === "A" && r.actualStatus === 404) {
      zeroLeakCount++;
    } else if (r.tenant === "B" && r.actualStatus === 200 && r.body.data.name === "Beta Confidential Schedule") {
      zeroLeakCount++;
    }
  });

  // Log structured metrics summary
  console.log("\n==================================================");
  console.log(" CONCURRENCY & TENANT ISOLATION BENCHMARK RESULTS ");
  console.log("==================================================");
  console.log(`  Total Concurrent Requests : ${TOTAL_REQUESTS}`);
  console.log(`  Total Execution Time      : ${totalDuration} ms`);
  console.log(`  Average Latency / Request : ${avgLatency} ms`);
  console.log(`  Zero-Leak Isolation Pass  : ${zeroLeakCount} / ${TOTAL_REQUESTS} (${((zeroLeakCount / TOTAL_REQUESTS) * 100).toFixed(1)}%)`);
  console.log(`  HTTP Status Distribution  :`, JSON.stringify(statusCounts));
  console.log("==================================================\n");

  assert.equal(zeroLeakCount, TOTAL_REQUESTS, "All concurrent requests must maintain 100% tenant isolation");
});
