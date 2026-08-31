import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "food-hunt-dev-secret-change-in-production";

export function signToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? "30d" : "1d";

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.fh_token;

  if (!token) {
    console.log("❌ NO fh_token RECEIVED");
    console.log("================================\n");

    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  try {
    const payload = verifyToken(token);

    req.user = {
      sub: payload.sub,
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    console.log("✅ JWT VALID");
    console.log("User ID:", payload.sub);
    console.log("Email:", payload.email);
    console.log("Role:", payload.role);
    console.log("========== AUTH SUCCESS ==========\n");

    next();
  } catch (error) {
    console.log("❌ JWT INVALID:", error.message);
    console.log("================================\n");

    clearAuthCookie(res);

    return res.status(401).json({
      error: "Session expired. Please log in again.",
    });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to do that.",
      });
    }

    next();
  };
}

export function setAuthCookie(res, token, rememberMe = false) {
  res.cookie("fh_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000,
    path: "/",
  });

  console.log("✅ fh_token COOKIE SET");
}

export function clearAuthCookie(res) {
  res.clearCookie("fh_token", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}