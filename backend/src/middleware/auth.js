const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "scheduleai-dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.userId || !payload.tenantId || !payload.role) {
      res.status(401).json({ error: "Token is missing tenant claims" });
      return;
    }

    req.user = payload;
    req.userId = payload.userId;
    req.tenantId = payload.tenantId;
    req.role = payload.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.userId && payload.tenantId && payload.role) {
      req.user = payload;
      req.userId = payload.userId;
      req.tenantId = payload.tenantId;
      req.role = payload.role;
    }
  } catch {
    // Public/demo workflows should not fail because an old token exists.
  }

  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      res.status(403).json({ error: "Insufficient role permissions" });
      return;
    }

    next();
  };
}

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
