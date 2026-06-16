import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import membersRouter from "./routes/members.js";
import attendanceRouter from "./routes/attendance.js";
import paymentsRouter from "./routes/payments.js";
import workoutPlansRouter from "./routes/workout-plans.js";
import brandingRouter from "./routes/branding.js";
import dashboardRouter from "./routes/dashboard.js";
import platformAdminRouter from "./routes/platform-admin.js";
import notificationsRouter from "./routes/notifications.js";
import uploadRouter from "./routes/upload.js";
import gymApplicationsRouter from "./routes/gym-applications.js";
import aiWorkoutRouter from "./routes/ai-workout.js";
import aiDietRouter from "./routes/ai-diet.js";
import gymRouter from "./routes/gym.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const uploadsDir = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/members", membersRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/workout-plans", workoutPlansRouter);
app.use("/api/branding", brandingRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/platform-admin", platformAdminRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/gym-applications", gymApplicationsRouter);
app.use("/api/ai-workout", aiWorkoutRouter);
app.use("/api/ai-diet", aiDietRouter);
app.use("/api/gym", gymRouter);

// In production, serve the built React app from the Vite output directory
const distPath = path.resolve(__dirname, "../../gym-app/dist/public");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — send index.html for any non-API route so client-side routing works
  app.get("/{*path}", (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on port ${PORT}`);
});

export default app;
