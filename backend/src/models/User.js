const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["owner", "admin", "faculty", "student"], default: "student" },
    isOwner: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.plugin(tenantScopedPlugin);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
