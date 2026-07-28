const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    department: { type: String, trim: true },
    subjects: [{ type: String, trim: true }],
  },
  { timestamps: true },
);

facultySchema.plugin(tenantScopedPlugin);

module.exports = mongoose.model("Faculty", facultySchema);
