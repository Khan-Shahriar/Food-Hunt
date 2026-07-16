import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import { requireAuth } from "./middleware/auth.js";
import db from "./db.js";
import offerRoutes from "./routes/offers.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8080;

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/user", userRoutes);

app.get("/api/dashboard", requireAuth, (_req, res) => {
  return res.json({
    message: "Dashboard data loaded.",
    news: [
      {
        title: "Lunch offer: 12% off at Spice Yard Kitchen",
        detail: "Valid for group orders above ৳1,000 before 1:00 PM.",
      },
    ],
  });
});

app.use(express.static(rootDir));

app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Food Hunt running at http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
