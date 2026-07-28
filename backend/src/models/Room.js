const mongoose = require("mongoose");
const { tenantScopedPlugin } = require("./tenantScopedPlugin");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["lecture", "lab", "seminar"], default: "lecture" },
    capacity: { type: Number, default: 40 },
  },
  { timestamps: true },
);

roomSchema.plugin(tenantScopedPlugin);
roomSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Room", roomSchema);
