const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const invitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "faculty", "student"], default: "student" },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

invitationSchema.plugin(tenantScopedPlugin);
invitationSchema.index({ tenantId: 1, email: 1, status: 1 });

module.exports = mongoose.model("Invitation", invitationSchema);
