import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "food-hunt-dev-secret-change-in-production";

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
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = verifyToken(token);

    req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role
    };

    next();
} catch {
    res.clearCookie("fh_token");
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do that." });
    }

    next();
  };
}

export function setAuthCookie(res, token, rememberMe = false) {
  res.cookie("fh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie("fh_token", { path: "/" });
}
