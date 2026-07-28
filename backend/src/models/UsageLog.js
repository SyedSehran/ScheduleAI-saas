const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const usageLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

usageLogSchema.plugin(tenantScopedPlugin);
usageLogSchema.index({ tenantId: 1, action: 1, createdAt: 1 });

module.exports = mongoose.model("UsageLog", usageLogSchema);
