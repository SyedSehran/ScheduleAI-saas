const Tenant = require("../models/Tenant");
const UsageLog = require("../models/UsageLog");

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function enforceTimetableLimit() {
  return async (req, res, next) => {
    try {
      if (!req.tenantId || !req.userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const tenant = await Tenant.findById(req.tenantId);
      if (!tenant || tenant.status !== "active") {
        res.status(403).json({ error: "Tenant is not active" });
        return;
      }

      const limit = tenant.plan?.timetableLimitPerMonth ?? Tenant.planLimit("free").timetableLimitPerMonth;
      const used = await UsageLog.countDocuments({
        tenantId: req.tenantId,
        action: "timetable.generate",
        createdAt: { $gte: startOfMonth() },
      });

      if (used >= limit) {
        res.status(403).json({
          error: "Monthly timetable generation limit reached for your plan",
          canUpgrade: true,
          plan: tenant.plan,
          usage: { used, limit },
        });
        return;
      }

      req.usage = { used, limit };
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function recordTimetableUsage(req, metadata = {}) {
  if (!req.tenantId || !req.userId) return;

  await UsageLog.create({
    tenantId: req.tenantId,
    userId: req.userId,
    action: "timetable.generate",
    metadata,
  });
}

module.exports = { enforceTimetableLimit, recordTimetableUsage, startOfMonth };
