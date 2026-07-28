const mongoose = require("mongoose");

const PLAN_LIMITS = {
  free: { timetableLimitPerMonth: 3 },
  pro: { timetableLimitPerMonth: 100 },
  enterprise: { timetableLimitPerMonth: 1000 },
};

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: {
      name: { type: String, enum: Object.keys(PLAN_LIMITS), default: "free" },
      timetableLimitPerMonth: { type: Number, default: PLAN_LIMITS.free.timetableLimitPerMonth },
    },
    status: { type: String, enum: ["active", "locked", "cancelled"], default: "active" },
  },
  { timestamps: true },
);

tenantSchema.statics.planLimit = function planLimit(planName) {
  return PLAN_LIMITS[planName] || PLAN_LIMITS.free;
};

module.exports = mongoose.model("Tenant", tenantSchema);
