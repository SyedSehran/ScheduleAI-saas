const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    studentCount: { type: Number, default: 40 },
  },
  { timestamps: true },
);

sectionSchema.plugin(tenantScopedPlugin);
sectionSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Section", sectionSchema);
