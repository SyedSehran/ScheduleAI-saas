const mongoose = require("mongoose");

function tenantScopedPlugin(schema) {
  schema.add({
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
  });

  schema.query.byTenant = function byTenant(tenantId) {
    return this.where({ tenantId });
  };

  schema.statics.forTenant = function forTenant(tenantId) {
    if (!tenantId) {
      throw new Error("tenantId is required for tenant-scoped queries");
    }

    return this.find({ tenantId });
  };
}

function scopedFilter(req, extra = {}) {
  if (!req?.tenantId) {
    throw new Error("Missing tenant context");
  }

  return { ...extra, tenantId: req.tenantId };
}

function createTenantRecord(Model, req, data) {
  return Model.create({ ...data, tenantId: req.tenantId });
}

module.exports = { tenantScopedPlugin, scopedFilter, createTenantRecord };
