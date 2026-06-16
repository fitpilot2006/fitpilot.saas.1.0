import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, gymUsersTable, gymsTable, accessCodesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { signGymToken } from "../lib/jwt.js";

const router = Router();

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) return false;
  entry.count++;
  return true;
}

function sanitizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeString(val: unknown, maxLen = 200): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

function generateMemberJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

router.post("/login", async (req, res) => {
  try {
    const emailRaw = req.body?.email;
    const passwordRaw = req.body?.password;

    const email = sanitizeEmail(emailRaw);
    if (!email || typeof passwordRaw !== "string" || passwordRaw.length === 0 || passwordRaw.length > 256) {
      res.status(400).json({ error: "Valid email and password required" });
      return;
    }

    const clientKey = String(req.ip ?? req.socket?.remoteAddress ?? "unknown") + ":" + email;
    if (!checkRateLimit(clientKey)) {
      res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes and try again." });
      return;
    }

    const [user] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.email, email)).limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(passwordRaw, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, user.gymId)).limit(1);

    if (gym?.status === "suspended") {
      res.status(403).json({ error: "Your gym account has been suspended. Please contact support." });
      return;
    }

    const token = signGymToken({
      userId: user.id,
      gymId: user.gymId,
      email: user.email,
      role: user.role,
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, gymId: user.gymId } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/signup/gym", async (req, res) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    const email = sanitizeEmail(req.body?.email);
    const passwordRaw = req.body?.password;
    const gymName = sanitizeString(req.body?.gymName, 100);
    const accessCode = sanitizeString(req.body?.accessCode, 20);

    if (!name || !email || !gymName || !accessCode) {
      res.status(400).json({ error: "All fields required" });
      return;
    }
    if (typeof passwordRaw !== "string" || passwordRaw.length < 6 || passwordRaw.length > 256) {
      res.status(400).json({ error: "Password must be 6–256 characters" });
      return;
    }

    const [code] = await db.select().from(accessCodesTable).where(
      and(eq(accessCodesTable.code, accessCode.toUpperCase()), eq(accessCodesTable.active, true), eq(accessCodesTable.used, false))
    ).limit(1);

    if (!code) {
      res.status(400).json({ error: "Invalid or already used access code" });
      return;
    }

    const [existing] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.email, email)).limit(1);
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const slug = gymName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now();
    const memberJoinCode = generateMemberJoinCode();

    const codePlan: string = (code as any).plan ?? "basic";
    const memberLimitByPlan: Record<string, number | null> = { basic: 100, pro: 500, enterprise: null, starter: 100 };
    const memberLimit = memberLimitByPlan[codePlan] ?? 100;

    const [gym] = await db.insert(gymsTable).values({
      name: gymName, slug, memberJoinCode, plan: codePlan,
      memberLimit: memberLimit ?? undefined,
    }).returning();
    const passwordHash = await bcrypt.hash(passwordRaw, 10);
    const [user] = await db.insert(gymUsersTable).values({ gymId: gym.id, email, passwordHash, name, role: "owner" }).returning();

    await db.update(accessCodesTable).set({ used: true, usedAt: new Date(), usedByGymId: gym.id }).where(eq(accessCodesTable.id, code.id));

    const token = signGymToken({ userId: user.id, gymId: gym.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, gymId: gym.id } });
  } catch (err) {
    console.error("Gym signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/signup/member", async (req, res) => {
  try {
    const name = sanitizeString(req.body?.name, 100);
    const email = sanitizeEmail(req.body?.email);
    const passwordRaw = req.body?.password;
    const joinCode = sanitizeString(req.body?.joinCode, 20);
    const phone = sanitizeString(req.body?.phone, 30);

    if (!name || !email || !joinCode || !phone) {
      res.status(400).json({ error: "All fields required" });
      return;
    }
    if (typeof passwordRaw !== "string" || passwordRaw.length < 6 || passwordRaw.length > 256) {
      res.status(400).json({ error: "Password must be 6–256 characters" });
      return;
    }

    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.memberJoinCode, joinCode.toUpperCase())).limit(1);

    if (!gym) {
      res.status(400).json({ error: "Invalid gym join code" });
      return;
    }

    if (gym.status === "suspended") {
      res.status(403).json({ error: "This gym is currently suspended" });
      return;
    }

    if (gym.memberLimit !== null) {
      const { membersTable: mTable } = await import("@workspace/db");
      const existingMembers = await db.select().from(mTable).where(eq(mTable.gymId, gym.id));
      if (existingMembers.length >= gym.memberLimit) {
        res.status(403).json({ error: "Member limit reached. Please ask the gym owner to upgrade their plan." });
        return;
      }
    }

    const [existing] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.email, email)).limit(1);
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(passwordRaw, 10);
    const [user] = await db.insert(gymUsersTable).values({ gymId: gym.id, email, passwordHash, name, role: "member" }).returning();

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    const expiryStr = expiry.toISOString().split("T")[0];

    const { membersTable } = await import("@workspace/db");
    await db.insert(membersTable).values({ gymId: gym.id, name, email, phone: phone || "", membershipType: "basic", membershipExpiry: expiryStr });

    const token = signGymToken({ userId: user.id, gymId: gym.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, gymId: gym.id } });
  } catch (err) {
    console.error("Member signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { verifyToken } = await import("../lib/jwt.js");
    const payload = verifyToken(auth.slice(7)) as { userId: number; gymId: number; email: string; role: string };
    const [user] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.id, payload.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, gymId: user.gymId });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
