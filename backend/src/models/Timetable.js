const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const timetableSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parsed: { type: mongoose.Schema.Types.Mixed, default: {} },
    schedule: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

timetableSchema.plugin(tenantScopedPlugin);

module.exports = mongoose.model("Timetable", timetableSchema);
