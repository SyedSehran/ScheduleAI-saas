const express = require("express");
const Faculty = require("../models/Faculty");
const Room = require("../models/Room");
const Section = require("../models/Section");
const Timetable = require("../models/Timetable");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const UsageLog = require("../models/UsageLog");
const Tenant = require("../models/Tenant");
const { scopedFilter, createTenantRecord } = require("../models/tenantScopedPlugin");
const { requireAuth, requireRole } = require("../middleware/auth");
const { startOfMonth } = require("../middleware/usageLimit");

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function makeCrudRoutes(path, Model, permissions) {
  router.get(
    path,
    requireAuth,
    requireRole(...permissions.read),
    asyncRoute(async (req, res) => {
      const records = await Model.find(scopedFilter(req)).sort({ createdAt: -1 });
      res.json({ data: records });
    }),
  );

  router.post(
    path,
    requireAuth,
    requireRole(...permissions.write),
    asyncRoute(async (req, res) => {
      const record = await createTenantRecord(Model, req, req.body || {});
      res.status(201).json({ data: record });
    }),
  );

  router.get(
    `${path}/:id`,
    requireAuth,
    requireRole(...permissions.read),
    asyncRoute(async (req, res) => {
      const record = await Model.findOne(scopedFilter(req, { _id: req.params.id }));
      if (!record) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.json({ data: record });
    }),
  );

  router.patch(
    `${path}/:id`,
    requireAuth,
    requireRole(...permissions.write),
    asyncRoute(async (req, res) => {
      const record = await Model.findOneAndUpdate(
        scopedFilter(req, { _id: req.params.id }),
        { $set: req.body || {} },
        { new: true, runValidators: true },
      );
      if (!record) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.json({ data: record });
    }),
  );

  router.delete(
    `${path}/:id`,
    requireAuth,
    requireRole(...permissions.write),
    asyncRoute(async (req, res) => {
      const record = await Model.findOneAndDelete(scopedFilter(req, { _id: req.params.id }));
      if (!record) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.status(204).end();
    }),
  );
}

const adminOnly = { read: ["owner", "admin"], write: ["owner", "admin"] };
const allRolesReadAdminWrite = { read: ["owner", "admin", "faculty", "student"], write: ["owner", "admin"] };

makeCrudRoutes("/faculties", Faculty, allRolesReadAdminWrite);
makeCrudRoutes("/rooms", Room, allRolesReadAdminWrite);
makeCrudRoutes("/sections", Section, allRolesReadAdminWrite);
makeCrudRoutes("/timetables", Timetable, adminOnly);

router.post(
  "/timetables/from-schedule",
  requireAuth,
  requireRole("owner", "admin"),
  asyncRoute(async (req, res) => {
    const { name = "Generated timetable", parsed, schedule } = req.body || {};
    const timetable = await createTenantRecord(Timetable, req, {
      name,
      parsed,
      schedule,
      createdBy: req.userId,
    });

    res.status(201).json({ data: timetable });
  }),
);

router.get(
  "/admin/dashboard",
  requireAuth,
  requireRole("owner", "admin"),
  asyncRoute(async (req, res) => {
    const [tenant, usageUsed, users, invitations, timetables] = await Promise.all([
      Tenant.findById(req.tenantId),
      UsageLog.countDocuments({
        tenantId: req.tenantId,
        action: "timetable.generate",
        createdAt: { $gte: startOfMonth() },
      }),
      User.find(scopedFilter(req)).select("-passwordHash").sort({ createdAt: -1 }),
      Invitation.find(scopedFilter(req)).sort({ createdAt: -1 }),
      Timetable.find(scopedFilter(req)).select("name createdBy createdAt").sort({ createdAt: -1 }).limit(10),
    ]);

    const roleCounts = users.reduce((counts, user) => {
      counts[user.role] = (counts[user.role] || 0) + 1;
      return counts;
    }, {});

    const usageLimit = tenant?.plan?.timetableLimitPerMonth ?? 0;
    res.json({
      tenant,
      plan: tenant?.plan,
      usage: {
        action: "timetable.generate",
        used: usageUsed,
        limit: usageLimit,
        remaining: Math.max(usageLimit - usageUsed, 0),
      },
      users,
      roleCounts,
      invitations,
      recentTimetables: timetables,
    });
  }),
);

module.exports = router;
