const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const { scopedFilter } = require("../models/tenantScopedPlugin");
const { signToken, requireAuth, requireRole } = require("../middleware/auth");

const rateLimit = require("express-rate-limit");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignupFields({ collegeName, name, email, password }) {
  if (!collegeName || !name || !email || !password) {
    return "collegeName, name, email, and password are required";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Please provide a valid email address";
  }
  if (String(password).length < 8) {
    return "Password must be at least 8 characters long";
  }
  return null;
}

async function uniqueSlug(name) {
  const base = slugify(name) || "college";
  let slug = base;
  let suffix = 2;

  while (await Tenant.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function publicUser(user) {
  return {
    id: user._id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    isOwner: user.isOwner,
  };
}

router.post("/signup", authLimiter, async (req, res, next) => {
  try {
    const { collegeName, name, email, password, plan = "free" } = req.body || {};
    const validationError = validateSignupFields({ collegeName, name, email, password });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const planLimit = Tenant.planLimit(plan);
    const tenant = await Tenant.create({
      name: collegeName,
      slug: await uniqueSlug(collegeName),
      plan: { name: plan, timetableLimitPerMonth: planLimit.timetableLimitPerMonth },
    });

    const user = await User.create({
      tenantId: tenant._id,
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: "owner",
      isOwner: true,
    });

    res.status(201).json({
      tenant,
      user: publicUser(user),
      token: signToken(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password, tenantSlug } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    // Same person can own accounts at two institutions; tenantSlug disambiguates.
    const normalizedEmail = String(email).toLowerCase().trim();
    const tenant = tenantSlug ? await Tenant.findOne({ slug: tenantSlug }) : null;
    const filter = tenant ? { email: normalizedEmail, tenantId: tenant._id } : { email: normalizedEmail };
    const user = await User.findOne(filter);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/invitations", requireAuth, requireRole("owner", "admin"), async (req, res, next) => {
  try {
    const { email, role = "student" } = req.body || {};
    if (!email || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }
    if (!["owner", "admin", "faculty", "student"].includes(role)) {
      res.status(400).json({ error: "role must be one of owner, admin, faculty, student" });
      return;
    }

    const invitation = await Invitation.create({
      tenantId: req.tenantId,
      email: String(email).toLowerCase().trim(),
      role,
      token: crypto.randomBytes(24).toString("hex"),
      invitedBy: req.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.status(201).json({ invitation });
  } catch (error) {
    next(error);
  }
});

router.post("/invitations/accept", async (req, res, next) => {
  try {
    const { token, name, password } = req.body || {};
    if (!token || !name || !password) {
      res.status(400).json({ error: "token, name, and password are required" });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters long" });
      return;
    }

    const invitation = await Invitation.findOne({ token, status: "pending", expiresAt: { $gt: new Date() } });
    if (!invitation) {
      res.status(404).json({ error: "Invitation not found or expired" });
      return;
    }

    const user = await User.create({
      tenantId: invitation.tenantId,
      name,
      email: invitation.email,
      passwordHash: await bcrypt.hash(password, 12),
      role: invitation.role,
    });

    invitation.status = "accepted";
    await invitation.save();

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne(scopedFilter(req, { _id: req.userId }));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
