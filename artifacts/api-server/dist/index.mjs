import { createRequire } from 'module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/jwt.ts
var jwt_exports = {};
__export(jwt_exports, {
  signGymToken: () => signGymToken,
  signPlatformAdminToken: () => signPlatformAdminToken,
  verifyToken: () => verifyToken
});
import jwt from "jsonwebtoken";
function signGymToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}
function signPlatformAdminToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
var SECRET;
var init_jwt = __esm({
  "src/lib/jwt.ts"() {
    "use strict";
    SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
  }
});

// src/index.ts
import express from "express";
import cors from "cors";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";

// src/routes/auth.ts
init_jwt();
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, gymUsersTable, gymsTable, accessCodesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
var router = Router();
var loginAttempts = /* @__PURE__ */ new Map();
var MAX_LOGIN_ATTEMPTS = 10;
var RATE_WINDOW_MS = 15 * 60 * 1e3;
function checkRateLimit(key) {
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
function sanitizeEmail(email) {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}
function sanitizeString(val, maxLen = 200) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}
function generateMemberJoinCode() {
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
      role: user.role
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
      res.status(400).json({ error: "Password must be 6\u2013256 characters" });
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
    const codePlan = code.plan ?? "basic";
    const memberLimitByPlan = { basic: 100, pro: 500, enterprise: null, starter: 100 };
    const memberLimit = memberLimitByPlan[codePlan] ?? 100;
    const [gym] = await db.insert(gymsTable).values({
      name: gymName,
      slug,
      memberJoinCode,
      plan: codePlan,
      memberLimit: memberLimit ?? void 0
    }).returning();
    const passwordHash = await bcrypt.hash(passwordRaw, 10);
    const [user] = await db.insert(gymUsersTable).values({ gymId: gym.id, email, passwordHash, name, role: "owner" }).returning();
    await db.update(accessCodesTable).set({ used: true, usedAt: /* @__PURE__ */ new Date(), usedByGymId: gym.id }).where(eq(accessCodesTable.id, code.id));
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
      res.status(400).json({ error: "Password must be 6\u2013256 characters" });
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
    const expiry = /* @__PURE__ */ new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    const expiryStr = expiry.toISOString().split("T")[0];
    const { membersTable: membersTable9 } = await import("@workspace/db");
    await db.insert(membersTable9).values({ gymId: gym.id, name, email, phone: phone || "", membershipType: "basic", membershipExpiry: expiryStr });
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
    const { verifyToken: verifyToken2 } = await Promise.resolve().then(() => (init_jwt(), jwt_exports));
    const payload = verifyToken2(auth.slice(7));
    const [user] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.id, payload.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, gymId: user.gymId });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
var auth_default = router;

// src/routes/members.ts
import { Router as Router2 } from "express";
import { db as db2, membersTable } from "@workspace/db";
import { eq as eq2, and as and2, desc } from "drizzle-orm";

// src/middlewares/auth.ts
init_jwt();
function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(token);
    if (payload.role === "platform_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const p = payload;
    req.userId = p.userId;
    req.gymId = p.gymId;
    req.userEmail = p.email;
    req.userRole = p.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
function requirePlatformAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(token);
    if (payload.role !== "platform_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const p = payload;
    req.adminId = p.adminId;
    req.userEmail = p.email;
    req.userRole = "platform_admin";
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// src/routes/members.ts
var router2 = Router2();
router2.use(requireAuth);
function genMemberCode() {
  const digits = Math.floor(1e4 + Math.random() * 9e4);
  return `MEM-${digits}`;
}
function effectiveStatus(m) {
  if (m.status === "active") {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(m.membershipExpiry) < today) return "expired";
  }
  return m.status;
}
function serializeMember(m) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    membershipType: m.membershipType,
    membershipExpiry: m.membershipExpiry,
    status: effectiveStatus(m),
    joinedAt: m.joinedAt,
    workoutPlanId: m.workoutPlanId,
    notes: m.notes,
    photoUrl: m.photoUrl,
    qrToken: m.qrToken,
    memberCode: m.memberCode,
    emergencyContact: m.emergencyContact,
    address: m.address,
    dateOfBirth: m.dateOfBirth
  };
}
router2.get("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { status, search } = req.query;
    let members = await db2.select().from(membersTable).where(eq2(membersTable.gymId, gymId)).orderBy(desc(membersTable.joinedAt));
    if (status) members = members.filter((m) => effectiveStatus(m) === status);
    if (search) {
      const s = search.toLowerCase();
      members = members.filter(
        (m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s) || m.phone.includes(s) || (m.memberCode ?? "").toLowerCase().includes(s)
      );
    }
    res.json(members.map(serializeMember));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router2.post("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { name, email, phone, membershipType, membershipExpiry, workoutPlanId, notes, emergencyContact, address } = req.body;
    if (!name || !email || !phone || !membershipType || !membershipExpiry) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const { gymsTable: gymsTable6 } = await import("@workspace/db");
    const { eq: eqFn } = await import("drizzle-orm");
    const [gym] = await db2.select().from(gymsTable6).where(eqFn(gymsTable6.id, gymId)).limit(1);
    if (gym?.memberLimit !== null && gym?.memberLimit !== void 0) {
      const existing = await db2.select().from(membersTable).where(eq2(membersTable.gymId, gymId));
      if (existing.length >= gym.memberLimit) {
        res.status(403).json({ error: `Member limit reached (${gym.memberLimit}). Upgrade your plan to add more members.` });
        return;
      }
    }
    const qrToken = `GF-${gymId}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const memberCode = genMemberCode();
    const [member] = await db2.insert(membersTable).values({
      gymId,
      name,
      email,
      phone,
      membershipType,
      membershipExpiry,
      workoutPlanId: workoutPlanId ?? null,
      notes: notes ?? null,
      emergencyContact: emergencyContact ?? null,
      address: address ?? null,
      qrToken,
      memberCode
    }).returning();
    res.status(201).json(serializeMember(member));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router2.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const email = req.userEmail;
    const [member] = await db2.select().from(membersTable).where(and2(eq2(membersTable.gymId, gymId), eq2(membersTable.email, email))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member profile not found" });
      return;
    }
    res.json(serializeMember(member));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router2.get("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [member] = await db2.select().from(membersTable).where(and2(eq2(membersTable.id, id), eq2(membersTable.gymId, gymId))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json(serializeMember(member));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router2.patch("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [existing] = await db2.select().from(membersTable).where(and2(eq2(membersTable.id, id), eq2(membersTable.gymId, gymId))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const allowed = ["name", "email", "phone", "membershipType", "membershipExpiry", "status", "workoutPlanId", "notes", "photoUrl", "emergencyContact", "address", "dateOfBirth"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== void 0) updates[key] = req.body[key];
    }
    const [updated] = await db2.update(membersTable).set(updates).where(and2(eq2(membersTable.id, id), eq2(membersTable.gymId, gymId))).returning();
    res.json(serializeMember(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router2.delete("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [existing] = await db2.select().from(membersTable).where(and2(eq2(membersTable.id, id), eq2(membersTable.gymId, gymId))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    await db2.delete(membersTable).where(and2(eq2(membersTable.id, id), eq2(membersTable.gymId, gymId)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var members_default = router2;

// src/routes/attendance.ts
import { Router as Router3 } from "express";
import { db as db3, attendanceTable, membersTable as membersTable2 } from "@workspace/db";
import { eq as eq3, and as and3, desc as desc2 } from "drizzle-orm";
var router3 = Router3();
router3.use(requireAuth);
router3.get("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { memberId, date } = req.query;
    let records = await db3.select().from(attendanceTable).where(eq3(attendanceTable.gymId, gymId)).orderBy(desc2(attendanceTable.checkInAt));
    if (memberId) records = records.filter((r) => r.memberId === Number(memberId));
    if (date) {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      records = records.filter((r) => r.checkInAt >= start && r.checkInAt <= end);
    }
    res.json(records.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      notes: r.notes
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.get("/today", async (req, res) => {
  try {
    const gymId = req.gymId;
    const now = /* @__PURE__ */ new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const records = await db3.select().from(attendanceTable).where(eq3(attendanceTable.gymId, gymId));
    const todayRecords = records.filter((r) => r.checkInAt >= start && r.checkInAt <= end);
    res.json(todayRecords.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      notes: r.notes
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const email = req.userEmail;
    const [member] = await db3.select().from(membersTable2).where(and3(eq3(membersTable2.gymId, gymId), eq3(membersTable2.email, email))).limit(1);
    if (!member) {
      res.json([]);
      return;
    }
    const records = await db3.select().from(attendanceTable).where(and3(eq3(attendanceTable.gymId, gymId), eq3(attendanceTable.memberId, member.id))).orderBy(desc2(attendanceTable.checkInAt)).limit(100);
    res.json(records.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      notes: r.notes
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router3.post("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { memberId, notes } = req.body;
    if (!memberId) {
      res.status(400).json({ error: "memberId required" });
      return;
    }
    const [member] = await db3.select().from(membersTable2).where(and3(eq3(membersTable2.id, memberId), eq3(membersTable2.gymId, gymId))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const [record] = await db3.insert(attendanceTable).values({
      gymId,
      memberId,
      memberName: member.name,
      notes: notes ?? null
    }).returning();
    res.status(201).json({
      id: record.id,
      memberId: record.memberId,
      memberName: record.memberName,
      checkInAt: record.checkInAt,
      checkOutAt: record.checkOutAt,
      notes: record.notes
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var attendance_default = router3;

// src/routes/payments.ts
import { Router as Router4 } from "express";
import { db as db4, paymentsTable, membersTable as membersTable3 } from "@workspace/db";
import { eq as eq4, and as and4, desc as desc3 } from "drizzle-orm";
var router4 = Router4();
router4.use(requireAuth);
router4.get("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { memberId, status } = req.query;
    let payments = await db4.select().from(paymentsTable).where(eq4(paymentsTable.gymId, gymId)).orderBy(desc3(paymentsTable.createdAt));
    if (memberId) payments = payments.filter((p) => p.memberId === Number(memberId));
    if (status) payments = payments.filter((p) => p.status === status);
    res.json(payments.map((p) => ({
      id: p.id,
      memberId: p.memberId,
      memberName: p.memberName,
      amount: Number(p.amount),
      status: p.status,
      description: p.description,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      createdAt: p.createdAt
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router4.post("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { memberId, amount, description, dueDate, status } = req.body;
    if (!memberId || amount === void 0 || !dueDate) {
      res.status(400).json({ error: "memberId, amount, dueDate required" });
      return;
    }
    const { membersTable: mt } = await import("@workspace/db");
    const [member] = await db4.select().from(mt).where(and4(eq4(mt.id, Number(memberId)), eq4(mt.gymId, gymId))).limit(1);
    const memberName = member?.name ?? "Unknown";
    const [payment] = await db4.insert(paymentsTable).values({
      gymId,
      memberId,
      memberName,
      amount: String(amount),
      description: description ?? null,
      dueDate,
      status: status ?? "pending"
    }).returning();
    res.status(201).json({
      id: payment.id,
      memberId: payment.memberId,
      memberName: payment.memberName,
      amount: Number(payment.amount),
      status: payment.status,
      description: payment.description,
      dueDate: payment.dueDate,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router4.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const email = req.userEmail;
    const [member] = await db4.select().from(membersTable3).where(and4(eq4(membersTable3.gymId, gymId), eq4(membersTable3.email, email))).limit(1);
    if (!member) {
      res.json([]);
      return;
    }
    const payments = await db4.select().from(paymentsTable).where(and4(eq4(paymentsTable.gymId, gymId), eq4(paymentsTable.memberId, member.id))).orderBy(desc3(paymentsTable.createdAt)).limit(50);
    res.json(payments.map((p) => ({
      id: p.id,
      memberId: p.memberId,
      memberName: p.memberName,
      amount: Number(p.amount),
      status: p.status,
      description: p.description,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      createdAt: p.createdAt
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router4.patch("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [existing] = await db4.select().from(paymentsTable).where(and4(eq4(paymentsTable.id, id), eq4(paymentsTable.gymId, gymId))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    const { amount, status, description, dueDate, paidAt } = req.body;
    const updates = {};
    if (amount !== void 0) updates.amount = String(amount);
    if (status !== void 0) updates.status = status;
    if (description !== void 0) updates.description = description;
    if (dueDate !== void 0) updates.dueDate = dueDate;
    if (paidAt !== void 0) updates.paidAt = paidAt ? new Date(paidAt) : null;
    const [updated] = await db4.update(paymentsTable).set(updates).where(and4(eq4(paymentsTable.id, id), eq4(paymentsTable.gymId, gymId))).returning();
    res.json({
      id: updated.id,
      memberId: updated.memberId,
      memberName: updated.memberName,
      amount: Number(updated.amount),
      status: updated.status,
      description: updated.description,
      dueDate: updated.dueDate,
      paidAt: updated.paidAt,
      createdAt: updated.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var payments_default = router4;

// src/routes/workout-plans.ts
import { Router as Router5 } from "express";
import { db as db5, workoutPlansTable } from "@workspace/db";
import { eq as eq5, and as and5, desc as desc4 } from "drizzle-orm";
var router5 = Router5();
router5.use(requireAuth);
function serialize(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    difficulty: p.difficulty,
    durationWeeks: p.durationWeeks,
    exercises: p.exercises,
    createdAt: p.createdAt
  };
}
router5.get("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const plans = await db5.select().from(workoutPlansTable).where(eq5(workoutPlansTable.gymId, gymId)).orderBy(desc4(workoutPlansTable.createdAt));
    res.json(plans.map(serialize));
  } catch (err) {
    console.error("[workout-plans/get]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router5.post("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { name, description, difficulty, durationWeeks, exercises } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [plan] = await db5.insert(workoutPlansTable).values({
      gymId,
      name,
      description: description ?? null,
      difficulty: difficulty ?? "beginner",
      durationWeeks: durationWeeks ?? 4,
      exercises: exercises ?? []
    }).returning();
    res.status(201).json(serialize(plan));
  } catch (err) {
    console.error("[workout-plans/post]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router5.get("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [plan] = await db5.select().from(workoutPlansTable).where(and5(eq5(workoutPlansTable.id, id), eq5(workoutPlansTable.gymId, gymId))).limit(1);
    if (!plan) {
      res.status(404).json({ error: "Workout plan not found" });
      return;
    }
    res.json(serialize(plan));
  } catch (err) {
    console.error("[workout-plans/get-id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router5.patch("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [existing] = await db5.select().from(workoutPlansTable).where(and5(eq5(workoutPlansTable.id, id), eq5(workoutPlansTable.gymId, gymId))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Workout plan not found" });
      return;
    }
    const { name, description, difficulty, durationWeeks, exercises } = req.body;
    const updates = {};
    if (name !== void 0) updates.name = name;
    if (description !== void 0) updates.description = description;
    if (difficulty !== void 0) updates.difficulty = difficulty;
    if (durationWeeks !== void 0) updates.durationWeeks = durationWeeks;
    if (exercises !== void 0) updates.exercises = exercises;
    const [updated] = await db5.update(workoutPlansTable).set(updates).where(and5(eq5(workoutPlansTable.id, id), eq5(workoutPlansTable.gymId, gymId))).returning();
    res.json(serialize(updated));
  } catch (err) {
    console.error("[workout-plans/patch]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router5.delete("/:id", async (req, res) => {
  try {
    const gymId = req.gymId;
    const id = Number(req.params.id);
    const [existing] = await db5.select().from(workoutPlansTable).where(and5(eq5(workoutPlansTable.id, id), eq5(workoutPlansTable.gymId, gymId))).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Workout plan not found" });
      return;
    }
    await db5.delete(workoutPlansTable).where(and5(eq5(workoutPlansTable.id, id), eq5(workoutPlansTable.gymId, gymId)));
    res.status(204).send();
  } catch (err) {
    console.error("[workout-plans/delete]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var workout_plans_default = router5;

// src/routes/branding.ts
import { Router as Router6 } from "express";
import { db as db6, brandingTable, gymsTable as gymsTable2 } from "@workspace/db";
import { eq as eq6 } from "drizzle-orm";
var router6 = Router6();
router6.use(requireAuth);
function serializeBranding(b) {
  return {
    id: b.id,
    gymName: b.gymName,
    tagline: b.tagline,
    logoUrl: b.logoUrl,
    bannerUrl: b.bannerUrl,
    thumbnailUrl: b.thumbnailUrl,
    faviconUrl: b.faviconUrl,
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    accentColor: b.accentColor,
    sidebarColor: b.sidebarColor,
    cardColor: b.cardColor,
    buttonColor: b.buttonColor,
    themeName: b.themeName,
    headingFont: b.headingFont,
    bodyFont: b.bodyFont,
    address: b.address,
    phone: b.phone,
    email: b.email,
    website: b.website,
    customCss: b.customCss
  };
}
router6.get("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [branding] = await db6.select().from(brandingTable).where(eq6(brandingTable.gymId, gymId)).limit(1);
    if (!branding) {
      const [gymRow] = await db6.select().from(gymsTable2).where(eq6(gymsTable2.id, gymId)).limit(1);
      const [created] = await db6.insert(brandingTable).values({
        gymId,
        gymName: gymRow?.name ?? "My Gym",
        primaryColor: "#f97316",
        secondaryColor: "#0f172a"
      }).returning();
      res.json(serializeBranding(created));
      return;
    }
    res.json(serializeBranding(branding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router6.put("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [existing] = await db6.select().from(brandingTable).where(eq6(brandingTable.gymId, gymId)).limit(1);
    const ALLOWED_FIELDS = [
      "gymName",
      "tagline",
      "logoUrl",
      "bannerUrl",
      "thumbnailUrl",
      "faviconUrl",
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "sidebarColor",
      "cardColor",
      "buttonColor",
      "themeName",
      "headingFont",
      "bodyFont",
      "address",
      "phone",
      "email",
      "website",
      "customCss"
    ];
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== void 0) updates[field] = req.body[field];
    }
    let branding;
    if (!existing) {
      const [created] = await db6.insert(brandingTable).values({ gymId, gymName: "My Gym", primaryColor: "#f97316", secondaryColor: "#0f172a", ...updates }).returning();
      branding = created;
    } else {
      const [updated] = await db6.update(brandingTable).set(updates).where(eq6(brandingTable.gymId, gymId)).returning();
      branding = updated;
    }
    res.json(serializeBranding(branding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var branding_default = router6;

// src/routes/dashboard.ts
import { Router as Router7 } from "express";
import { db as db7, membersTable as membersTable4, attendanceTable as attendanceTable2, paymentsTable as paymentsTable2, workoutPlansTable as workoutPlansTable2, gymsTable as gymsTable3 } from "@workspace/db";
import { eq as eq7, desc as desc5 } from "drizzle-orm";
var router7 = Router7();
router7.use(requireAuth);
function toMs(d) {
  if (!d) return 0;
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}
router7.get("/stats", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [members, payments, workoutPlans, allAttendance, gymRows] = await Promise.all([
      db7.select().from(membersTable4).where(eq7(membersTable4.gymId, gymId)),
      db7.select().from(paymentsTable2).where(eq7(paymentsTable2.gymId, gymId)),
      db7.select().from(workoutPlansTable2).where(eq7(workoutPlansTable2.gymId, gymId)),
      db7.select().from(attendanceTable2).where(eq7(attendanceTable2.gymId, gymId)),
      db7.select().from(gymsTable3).where(eq7(gymsTable3.id, gymId)).limit(1)
    ]);
    const gym = gymRows[0] ?? null;
    const now = /* @__PURE__ */ new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 864e5 - 1;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const todayCount = allAttendance.filter((a) => {
      const t = toMs(a.checkInAt);
      return t >= startOfDay && t <= endOfDay;
    }).length;
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const totalMembers = members.length;
    const activeMembers = members.filter(
      (m) => m.status === "active" && new Date(m.membershipExpiry).getTime() >= todayMidnight
    ).length;
    const expiredMembers = members.filter(
      (m) => m.status === "expired" || m.status === "active" && new Date(m.membershipExpiry).getTime() < todayMidnight
    ).length;
    const newMembersThisMonth = members.filter((m) => toMs(m.joinedAt) >= startOfMonth).length;
    const paidThisMonth = payments.filter((p) => {
      const t = toMs(p.createdAt);
      return p.status === "paid" && t >= startOfMonth;
    });
    const monthlyRevenue = paidThisMonth.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingPayments = payments.filter((p) => p.status !== "paid").reduce((sum, p) => sum + Number(p.amount), 0);
    const attendanceRate = totalMembers > 0 ? Math.round(todayCount / totalMembers * 100) : 0;
    res.json({
      totalMembers,
      activeMembers,
      expiredMembers,
      todayAttendance: todayCount,
      monthlyRevenue,
      pendingPayments,
      totalWorkoutPlans: workoutPlans.length,
      newMembersThisMonth,
      memberJoinCode: gym?.memberJoinCode ?? null,
      attendanceRate
    });
  } catch (err) {
    console.error("[dashboard/stats]", err?.message);
    res.status(500).json({ error: "Internal server error" });
  }
});
router7.get("/expiring-memberships", async (req, res) => {
  try {
    const gymId = req.gymId;
    const members = await db7.select().from(membersTable4).where(eq7(membersTable4.gymId, gymId));
    const now = /* @__PURE__ */ new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);
    const expiring = members.filter((m) => {
      const exp = new Date(m.membershipExpiry);
      return m.status === "active" && exp >= now && exp <= in7Days;
    });
    res.json(expiring.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      membershipType: m.membershipType,
      membershipExpiry: m.membershipExpiry,
      status: m.status
    })));
  } catch (err) {
    console.error("[dashboard/expiring]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router7.get("/recent-checkins", async (req, res) => {
  try {
    const gymId = req.gymId;
    const records = await db7.select().from(attendanceTable2).where(eq7(attendanceTable2.gymId, gymId)).orderBy(desc5(attendanceTable2.checkInAt)).limit(8);
    res.json(records);
  } catch (err) {
    console.error("[dashboard/recent-checkins]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router7.get("/revenue-chart", async (req, res) => {
  try {
    const gymId = req.gymId;
    const payments = await db7.select().from(paymentsTable2).where(eq7(paymentsTable2.gymId, gymId));
    const now = /* @__PURE__ */ new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const revenue = payments.filter((p) => {
        const t = toMs(p.createdAt);
        return p.status === "paid" && t >= start && t <= end;
      }).reduce((sum, p) => sum + Number(p.amount), 0);
      result.push({ month, revenue });
    }
    res.json(result);
  } catch (err) {
    console.error("[dashboard/revenue-chart]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router7.get("/attendance-chart", async (req, res) => {
  try {
    const gymId = req.gymId;
    const records = await db7.select().from(attendanceTable2).where(eq7(attendanceTable2.gymId, gymId));
    const now = /* @__PURE__ */ new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 864e5 - 1;
      const date = d.toISOString().split("T")[0];
      const count = records.filter((r) => {
        const t = toMs(r.checkInAt);
        return t >= start && t <= end;
      }).length;
      result.push({ date, count });
    }
    res.json(result);
  } catch (err) {
    console.error("[dashboard/attendance-chart]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var dashboard_default = router7;

// src/routes/platform-admin.ts
import { Router as Router8 } from "express";
import bcrypt2 from "bcryptjs";
import {
  db as db8,
  platformAdminsTable,
  gymsTable as gymsTable4,
  accessCodesTable as accessCodesTable2,
  gymSubscriptionsTable,
  membersTable as membersTable5,
  gymApplicationsTable,
  gymUsersTable as gymUsersTable2,
  paymentsTable as paymentsTable3,
  attendanceTable as attendanceTable3,
  workoutPlansTable as workoutPlansTable3,
  brandingTable as brandingTable2,
  notificationSettingsTable
} from "@workspace/db";
import { eq as eq8, and as and6, desc as desc6 } from "drizzle-orm";
init_jwt();
var router8 = Router8();
router8.post("/auth/bootstrap", async (req, res) => {
  try {
    const [existing] = await db8.select().from(platformAdminsTable).limit(1);
    if (existing) {
      res.status(409).json({ error: "Platform admin already exists" });
      return;
    }
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const passwordHash = await bcrypt2.hash(password, 10);
    const [admin] = await db8.insert(platformAdminsTable).values({ email, passwordHash, name: name ?? "Platform Admin" }).returning();
    const token = signPlatformAdminToken({ adminId: admin.id, email: admin.email, role: "platform_admin", gymId: 0 });
    res.status(201).json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bootstrap]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [admin] = await db8.select().from(platformAdminsTable).where(eq8(platformAdminsTable.email, email)).limit(1);
    if (!admin) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt2.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signPlatformAdminToken({ adminId: admin.id, email: admin.email, role: "platform_admin", gymId: 0 });
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[login]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.use(requirePlatformAdmin);
router8.get("/gyms", async (req, res) => {
  try {
    const gyms = await db8.select().from(gymsTable4).orderBy(desc6(gymsTable4.createdAt));
    const result = await Promise.all(gyms.map(async (g) => {
      const members = await db8.select().from(membersTable5).where(eq8(membersTable5.gymId, g.id));
      const [activeSub] = await db8.select().from(gymSubscriptionsTable).where(eq8(gymSubscriptionsTable.gymId, g.id)).orderBy(desc6(gymSubscriptionsTable.createdAt)).limit(1);
      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        plan: g.plan,
        status: g.status,
        memberJoinCode: g.memberJoinCode,
        memberLimit: g.memberLimit,
        subscriptionExpiry: g.subscriptionExpiry,
        createdAt: g.createdAt,
        memberCount: members.length,
        activeMembers: members.filter((m) => m.status === "active").length,
        latestSub: activeSub ? { plan: activeSub.plan, endDate: activeSub.endDate, status: activeSub.status } : null
      };
    }));
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gyms]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.patch("/gyms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, plan, name, memberLimit, subscriptionExpiry } = req.body;
    const updates = {};
    if (status !== void 0) updates.status = status;
    if (plan !== void 0) updates.plan = plan;
    if (name !== void 0) updates.name = name;
    if (memberLimit !== void 0) updates.memberLimit = memberLimit === "" ? null : Number(memberLimit);
    if (subscriptionExpiry !== void 0) updates.subscriptionExpiry = subscriptionExpiry || null;
    const [updated] = await db8.update(gymsTable4).set(updates).where(eq8(gymsTable4.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Gym not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gyms patch]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.get("/access-codes", async (req, res) => {
  try {
    const codes = await db8.select().from(accessCodesTable2).orderBy(desc6(accessCodesTable2.createdAt));
    res.json(codes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[access-codes]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.post("/access-codes", async (req, res) => {
  try {
    let generateCode2 = function() {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const part = () => {
        let s = "";
        for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
      };
      return `${part()}-${part()}`;
    };
    var generateCode = generateCode2;
    const { label, plan, trialDays } = req.body;
    const code = generateCode2();
    const validPlans = ["basic", "pro", "enterprise"];
    const codePlan = plan && validPlans.includes(plan) ? plan : "basic";
    const [created] = await db8.insert(accessCodesTable2).values({
      code,
      label: label ?? null,
      plan: codePlan,
      trialDays: trialDays ? Number(trialDays) : 30
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[access-codes post]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.delete("/access-codes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db8.delete(accessCodesTable2).where(eq8(accessCodesTable2.id, id));
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[access-codes delete]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.get("/subscriptions", async (req, res) => {
  try {
    const subs = await db8.select().from(gymSubscriptionsTable).orderBy(desc6(gymSubscriptionsTable.createdAt));
    const withGym = await Promise.all(subs.map(async (s) => {
      const [gym] = await db8.select().from(gymsTable4).where(eq8(gymsTable4.id, s.gymId)).limit(1);
      return { ...s, gymName: gym?.name ?? "Unknown" };
    }));
    res.json(withGym);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[subscriptions]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.post("/subscriptions", async (req, res) => {
  try {
    const { gymId, plan, startDate, endDate, notes } = req.body;
    if (!gymId || !plan || !startDate || !endDate) {
      res.status(400).json({ error: "gymId, plan, startDate, endDate required" });
      return;
    }
    const [sub] = await db8.insert(gymSubscriptionsTable).values({
      gymId: Number(gymId),
      plan,
      startDate,
      endDate,
      notes: notes ?? null
    }).returning();
    await db8.update(gymsTable4).set({ subscriptionExpiry: endDate, plan }).where(eq8(gymsTable4.id, Number(gymId)));
    res.status(201).json(sub);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[subscriptions post]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.get("/stats", async (req, res) => {
  try {
    const [gyms, codes, allMembers, applications] = await Promise.all([
      db8.select().from(gymsTable4),
      db8.select().from(accessCodesTable2),
      db8.select().from(membersTable5),
      db8.select().from(gymApplicationsTable)
    ]);
    const totalGyms = gyms.length;
    const activeGyms = gyms.filter((g) => g.status === "active").length;
    const suspendedGyms = gyms.filter((g) => g.status === "suspended").length;
    const unusedCodes = codes.filter((c) => !c.used && c.active).length;
    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter((m) => m.status === "active").length;
    const pendingApplications = applications.filter((a) => a.status === "pending").length;
    res.json({ totalGyms, activeGyms, suspendedGyms, unusedCodes, totalMembers, activeMembers, pendingApplications });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stats]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.get("/applications", async (req, res) => {
  try {
    const apps = await db8.select().from(gymApplicationsTable).orderBy(desc6(gymApplicationsTable.createdAt));
    res.json(apps);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[applications get]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.patch("/applications/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db8.select().from(gymApplicationsTable).where(eq8(gymApplicationsTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    const { action, assignedExpiry, assignedMemberLimit, rejectionReason, planRequest } = req.body;
    if (action === "approve") {
      let generateCode2 = function() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const part = () => {
          let s = "";
          for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
          return s;
        };
        return `${part()}-${part()}`;
      };
      var generateCode = generateCode2;
      const code = generateCode2();
      await db8.insert(accessCodesTable2).values({
        code,
        label: `${existing.gymName} \u2014 ${existing.ownerName}`
      });
      const [updated] = await db8.update(gymApplicationsTable).set({
        status: "approved",
        assignedAccessCode: code,
        assignedExpiry: assignedExpiry ?? null,
        assignedMemberLimit: assignedMemberLimit ? Number(assignedMemberLimit) : null
      }).where(eq8(gymApplicationsTable.id, id)).returning();
      res.json(updated);
    } else if (action === "reject") {
      const [updated] = await db8.update(gymApplicationsTable).set({
        status: "rejected",
        rejectionReason: rejectionReason ?? null
      }).where(eq8(gymApplicationsTable.id, id)).returning();
      res.json(updated);
    } else {
      const updates = {};
      if (assignedExpiry !== void 0) updates.assignedExpiry = assignedExpiry;
      if (assignedMemberLimit !== void 0) updates.assignedMemberLimit = Number(assignedMemberLimit);
      if (planRequest !== void 0) updates.planRequest = planRequest;
      const [updated] = await db8.update(gymApplicationsTable).set(updates).where(eq8(gymApplicationsTable.id, id)).returning();
      res.json(updated);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[applications patch]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.post("/impersonate/:gymId", async (req, res) => {
  try {
    const gymId = Number(req.params.gymId);
    const [gym] = await db8.select().from(gymsTable4).where(eq8(gymsTable4.id, gymId)).limit(1);
    if (!gym) {
      res.status(404).json({ error: "Gym not found" });
      return;
    }
    const [owner] = await db8.select().from(gymUsersTable2).where(eq8(gymUsersTable2.gymId, gymId)).limit(1);
    if (!owner) {
      res.status(404).json({ error: "No users found for this gym" });
      return;
    }
    const token = signGymToken({ userId: owner.id, gymId: owner.gymId, email: owner.email, role: owner.role });
    res.json({
      token,
      user: { id: owner.id, name: owner.name ?? owner.email, email: owner.email, role: owner.role, gymId: owner.gymId },
      gymName: gym.name
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[impersonate]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.delete("/gyms/:id", async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const [gym] = await db8.select().from(gymsTable4).where(eq8(gymsTable4.id, gymId)).limit(1);
    if (!gym) {
      res.status(404).json({ error: "Gym not found" });
      return;
    }
    await db8.delete(attendanceTable3).where(eq8(attendanceTable3.gymId, gymId));
    await db8.delete(paymentsTable3).where(eq8(paymentsTable3.gymId, gymId));
    await db8.delete(workoutPlansTable3).where(eq8(workoutPlansTable3.gymId, gymId));
    await db8.delete(membersTable5).where(eq8(membersTable5.gymId, gymId));
    await db8.delete(gymSubscriptionsTable).where(eq8(gymSubscriptionsTable.gymId, gymId));
    await db8.delete(gymUsersTable2).where(eq8(gymUsersTable2.gymId, gymId));
    await db8.delete(brandingTable2).where(eq8(brandingTable2.gymId, gymId));
    await db8.delete(notificationSettingsTable).where(eq8(notificationSettingsTable.gymId, gymId));
    await db8.delete(gymsTable4).where(eq8(gymsTable4.id, gymId));
    res.json({ success: true, deletedGymId: gymId, gymName: gym.name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delete gym]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.patch("/gyms/:id/credentials", async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const { email, password } = req.body;
    const newEmail = typeof email === "string" ? email.trim().toLowerCase() : void 0;
    const newPassword = typeof password === "string" ? password.trim() : void 0;
    if (!newEmail && !newPassword) {
      res.status(400).json({ error: "Provide at least an email or password to update" });
      return;
    }
    const [owner] = await db8.select().from(gymUsersTable2).where(and6(eq8(gymUsersTable2.gymId, gymId), eq8(gymUsersTable2.role, "owner"))).limit(1);
    if (!owner) {
      res.status(404).json({ error: "No owner account found for this gym" });
      return;
    }
    if (newEmail && newEmail !== owner.email) {
      const [conflict] = await db8.select().from(gymUsersTable2).where(eq8(gymUsersTable2.email, newEmail)).limit(1);
      if (conflict) {
        res.status(409).json({ error: "That email is already in use by another account" });
        return;
      }
    }
    const updates = {};
    if (newEmail) updates.email = newEmail;
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }
      updates.passwordHash = await bcrypt2.hash(newPassword, 10);
    }
    const [updated] = await db8.update(gymUsersTable2).set(updates).where(eq8(gymUsersTable2.id, owner.id)).returning();
    res.json({ id: updated.id, email: updated.email, role: updated.role });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[credentials]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.get("/backup/health", async (_req, res) => {
  try {
    const [gyms, members, payments, attendance, subscriptions, codes, users, applications, dbInfo] = await Promise.all([
      db8.select().from(gymsTable4),
      db8.select().from(membersTable5),
      db8.select().from(paymentsTable3),
      db8.select().from(attendanceTable3),
      db8.select().from(gymSubscriptionsTable),
      db8.select().from(accessCodesTable2),
      db8.select().from(gymUsersTable2),
      db8.select().from(gymApplicationsTable),
      db8.execute(
        "SELECT current_database(), split_part(version(), ' ', 2) AS pg_version"
      )
    ]);
    const dbRow = dbInfo.rows?.[0] ?? {};
    res.json({
      status: "healthy",
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      database: {
        provider: "Replit PostgreSQL",
        name: dbRow.current_database ?? "gymflow",
        version: dbRow.pg_version ?? "",
        connected: true
      },
      tables: {
        gyms: gyms.length,
        members: members.length,
        payments: payments.length,
        attendance: attendance.length,
        gym_subscriptions: subscriptions.length,
        access_codes: codes.length,
        gym_users: users.length,
        gym_applications: applications.length
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup/health]", msg);
    res.status(500).json({ status: "error", error: msg });
  }
});
router8.get("/backup/export", async (_req, res) => {
  try {
    const [gyms, members, payments, attendance, subscriptions, codes] = await Promise.all([
      db8.select().from(gymsTable4),
      db8.select().from(membersTable5),
      db8.select().from(paymentsTable3),
      db8.select().from(attendanceTable3),
      db8.select().from(gymSubscriptionsTable),
      db8.select().from(accessCodesTable2)
    ]);
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const backup = { exportedAt: (/* @__PURE__ */ new Date()).toISOString(), version: "2.0", gyms, members, payments, attendance, gym_subscriptions: subscriptions, access_codes: codes };
    res.setHeader("Content-Disposition", `attachment; filename="gymflow-backup-${date}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup/export]", msg);
    res.status(500).json({ error: msg });
  }
});
function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === void 0) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
router8.get("/backup/export/:table", async (req, res) => {
  const { table } = req.params;
  const format = req.query.format ?? "csv";
  try {
    let data = [];
    switch (table) {
      case "gyms":
        data = await db8.select().from(gymsTable4);
        break;
      case "members":
        data = await db8.select().from(membersTable5);
        break;
      case "payments":
        data = await db8.select().from(paymentsTable3);
        break;
      case "attendance":
        data = await db8.select().from(attendanceTable3);
        break;
      case "subscriptions":
        data = await db8.select().from(gymSubscriptionsTable);
        break;
      case "access_codes":
        data = await db8.select().from(accessCodesTable2);
        break;
      default:
        res.status(404).json({ error: "Unknown table" });
        return;
    }
    const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="gymflow-${table}-${date}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), table, count: data.length, data });
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="gymflow-${table}-${date}.csv"`);
      res.setHeader("Content-Type", "text/csv");
      res.send(toCSV(data));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup/export/:table]", msg);
    res.status(500).json({ error: msg });
  }
});
router8.post("/backup/import", async (req, res) => {
  const summary = {};
  function track(t) {
    if (!summary[t]) summary[t] = { inserted: 0, skipped: 0, errors: [] };
    return summary[t];
  }
  try {
    const data = req.body;
    for (const row of data.access_codes ?? []) {
      const t = track("access_codes");
      try {
        const result = await db8.insert(accessCodesTable2).values({
          code: String(row.code),
          label: row.label ? String(row.label) : null,
          active: Boolean(row.active ?? true),
          used: Boolean(row.used ?? false),
          usedAt: row.used_at ? new Date(String(row.used_at)) : null,
          usedByGymId: row.used_by_gym_id ? Number(row.used_by_gym_id) : null
        }).onConflictDoNothing().returning();
        if (result.length) t.inserted++;
        else t.skipped++;
      } catch (e) {
        t.errors.push(String(e.message));
      }
    }
    for (const row of data.gyms ?? []) {
      const t = track("gyms");
      try {
        const slug = String(row.slug ?? "").trim() || String(row.name ?? "gym").toLowerCase().replace(/[^a-z0-9]/g, "-");
        const [existing] = await db8.select().from(gymsTable4).where(eq8(gymsTable4.slug, slug)).limit(1);
        if (existing) {
          t.skipped++;
          continue;
        }
        await db8.insert(gymsTable4).values({
          name: String(row.name ?? "Imported Gym"),
          slug,
          plan: String(row.plan ?? "starter"),
          status: String(row.status ?? "active"),
          memberJoinCode: row.member_join_code ? String(row.member_join_code) : null,
          memberLimit: row.member_limit ? Number(row.member_limit) : null,
          subscriptionExpiry: row.subscription_expiry ? String(row.subscription_expiry) : null
        });
        t.inserted++;
      } catch (e) {
        t.errors.push(String(e.message));
      }
    }
    for (const row of data.members ?? []) {
      const t = track("members");
      try {
        const gymId = Number(row.gym_id ?? row.gymId ?? 0);
        if (!gymId) {
          t.skipped++;
          continue;
        }
        await db8.insert(membersTable5).values({
          gymId,
          name: String(row.name ?? ""),
          email: String(row.email ?? ""),
          phone: String(row.phone ?? ""),
          membershipType: String(row.membership_type ?? row.membershipType ?? "basic"),
          membershipExpiry: String(row.membership_expiry ?? row.membershipExpiry ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0]),
          status: String(row.status ?? "active"),
          notes: row.notes ? String(row.notes) : null
        });
        t.inserted++;
      } catch (e) {
        t.errors.push(String(e.message));
      }
    }
    for (const row of data.payments ?? []) {
      const t = track("payments");
      try {
        await db8.insert(paymentsTable3).values({
          gymId: Number(row.gym_id ?? row.gymId),
          memberId: Number(row.member_id ?? row.memberId),
          memberName: String(row.member_name ?? row.memberName ?? ""),
          amount: String(row.amount ?? "0"),
          status: String(row.status ?? "pending"),
          description: row.description ? String(row.description) : null,
          dueDate: String(row.due_date ?? row.dueDate ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0])
        });
        t.inserted++;
      } catch (e) {
        t.errors.push(String(e.message));
      }
    }
    for (const row of data.attendance ?? []) {
      const t = track("attendance");
      try {
        await db8.insert(attendanceTable3).values({
          gymId: Number(row.gym_id ?? row.gymId),
          memberId: Number(row.member_id ?? row.memberId),
          memberName: String(row.member_name ?? row.memberName ?? ""),
          checkInAt: row.check_in_at ? new Date(String(row.check_in_at)) : /* @__PURE__ */ new Date(),
          notes: row.notes ? String(row.notes) : null
        });
        t.inserted++;
      } catch (e) {
        t.errors.push(String(e.message));
      }
    }
    for (const row of data.gym_subscriptions ?? []) {
      const t = track("gym_subscriptions");
      try {
        await db8.insert(gymSubscriptionsTable).values({
          gymId: Number(row.gym_id ?? row.gymId),
          plan: String(row.plan ?? "starter"),
          startDate: String(row.start_date ?? row.startDate ?? ""),
          endDate: String(row.end_date ?? row.endDate ?? ""),
          status: String(row.status ?? "active"),
          notes: row.notes ? String(row.notes) : null
        });
        t.inserted++;
      } catch (e) {
        t.errors.push(String(e.message));
      }
    }
    const totalInserted = Object.values(summary).reduce((s, v) => s + v.inserted, 0);
    const totalSkipped = Object.values(summary).reduce((s, v) => s + v.skipped, 0);
    const totalErrors = Object.values(summary).reduce((s, v) => s + v.errors.length, 0);
    res.json({ success: totalErrors === 0, totalInserted, totalSkipped, totalErrors, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup/import]", msg);
    res.status(500).json({ error: msg });
  }
});
var platform_admin_default = router8;

// src/routes/notifications.ts
import { Router as Router9 } from "express";
import { db as db9, notificationSettingsTable as notificationSettingsTable2 } from "@workspace/db";
import { eq as eq9 } from "drizzle-orm";
var router9 = Router9();
router9.use(requireAuth);
var DEFAULT_TEMPLATES = {
  paymentTemplate: "Hi {name}, your payment of {amount} is due on {dueDate}. Please visit the gym to renew your membership.",
  expiryTemplate: "Hi {name}, your membership expires on {expiryDate} ({daysLeft} days left). Contact us to renew!",
  welcomeTemplate: "Welcome to our gym, {name}! Your membership is active until {expiryDate}. Great to have you!"
};
router9.get("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [settings] = await db9.select().from(notificationSettingsTable2).where(eq9(notificationSettingsTable2.gymId, gymId)).limit(1);
    if (!settings) {
      const [created] = await db9.insert(notificationSettingsTable2).values({ gymId, ...DEFAULT_TEMPLATES }).returning();
      res.json(created);
      return;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router9.put("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [existing] = await db9.select().from(notificationSettingsTable2).where(eq9(notificationSettingsTable2.gymId, gymId)).limit(1);
    const ALLOWED = [
      "twilioAccountSid",
      "twilioAuthToken",
      "whatsappNumber",
      "paymentReminderEnabled",
      "expiryReminderEnabled",
      "welcomeMessageEnabled",
      "overdueAlertEnabled",
      "paymentReminderDays",
      "expiryReminderDays",
      "paymentTemplate",
      "expiryTemplate",
      "welcomeTemplate"
    ];
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== void 0) updates[key] = req.body[key];
    }
    let settings;
    if (!existing) {
      const [created] = await db9.insert(notificationSettingsTable2).values({ gymId, ...DEFAULT_TEMPLATES, ...updates }).returning();
      settings = created;
    } else {
      const [updated] = await db9.update(notificationSettingsTable2).set(updates).where(eq9(notificationSettingsTable2.gymId, gymId)).returning();
      settings = updated;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var notifications_default = router9;

// src/routes/upload.ts
import { Router as Router10 } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
var router10 = Router10();
var uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
var upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  }
});
router10.post("/", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});
var upload_default = router10;

// src/routes/gym-applications.ts
import { Router as Router11 } from "express";
import { db as db10 } from "@workspace/db";
import { gymApplicationsTable as gymApplicationsTable2 } from "@workspace/db";
import nodemailer from "nodemailer";
var router11 = Router11();
async function sendAdminNotification(app2) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.log("[gym-applications] EMAIL_USER/EMAIL_PASS not set \u2014 skipping email notification");
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass }
    });
    await transporter.sendMail({
      from: `"FitPilot Platform" <${user}>`,
      to: "fitpilot.saas@gmail.com",
      subject: `\u{1F3CB}\uFE0F New Gym Application: ${app2.gymName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
            <div style="width:40px;height:40px;background:#7c3aed;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">\u{1F3CB}\uFE0F</div>
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:800;color:#fff">New Gym Application</h2>
              <p style="margin:2px 0 0;font-size:13px;color:#888">FitPilot Platform Admin</p>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888;width:130px">Gym Name</td>
              <td style="padding:10px 0;color:#fff;font-weight:600">${app2.gymName}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Owner Name</td>
              <td style="padding:10px 0;color:#fff">${app2.ownerName}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Email</td>
              <td style="padding:10px 0;color:#7c3aed">${app2.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Phone</td>
              <td style="padding:10px 0;color:#fff">${app2.phone}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Plan Interested In</td>
              <td style="padding:10px 0;color:#fff;text-transform:capitalize">${app2.planRequest}</td>
            </tr>
            ${app2.memberCount ? `<tr><td style="padding:10px 0;color:#888">Members</td><td style="padding:10px 0;color:#fff">${app2.memberCount}</td></tr>` : ""}
          </table>
          <div style="margin-top:24px;padding:16px;background:#111;border-radius:10px;border:1px solid #222">
            <p style="margin:0;font-size:13px;color:#888">Login to <strong style="color:#7c3aed">/platform-admin</strong> to review and respond to this application.</p>
          </div>
        </div>
      `
    });
    console.log("[gym-applications] Admin notification email sent to fitpilot.saas@gmail.com");
  } catch (err) {
    console.error("[gym-applications] Email notification failed:", err.message);
  }
}
router11.post("/", async (req, res) => {
  try {
    const { gymName, ownerName, phone, countryCode, email, address, planRequest, notes, memberCount } = req.body;
    if (!gymName || !ownerName || !phone || !email) {
      res.status(400).json({ error: "gymName, ownerName, phone, email required" });
      return;
    }
    const [app2] = await db10.insert(gymApplicationsTable2).values({
      gymName: gymName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      countryCode: (countryCode ?? "+1").trim(),
      email: email.trim().toLowerCase(),
      address: address ? address.trim() : null,
      planRequest: planRequest ?? "basic",
      notes: notes ? notes.trim() : null,
      memberCount: memberCount ? Number(memberCount) : null
    }).returning();
    sendAdminNotification({
      gymName: app2.gymName,
      ownerName: app2.ownerName,
      email: app2.email,
      phone: app2.phone,
      planRequest: app2.planRequest ?? "basic",
      memberCount: app2.memberCount
    }).catch(console.error);
    console.log(`[gym-applications] New application: ${app2.gymName} (${app2.email})`);
    res.status(201).json({ id: app2.id, message: "Application submitted. The platform admin will review it shortly." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gym-applications post]", msg);
    res.status(500).json({ error: msg });
  }
});
var gym_applications_default = router11;

// src/routes/ai-workout.ts
import { Router as Router12 } from "express";
import { db as db11, aiWorkoutPlansTable, membersTable as membersTable6 } from "@workspace/db";
import { eq as eq10, and as and7 } from "drizzle-orm";
var router12 = Router12();
router12.use(requireAuth);
var WEEK_THEMES = [
  {
    theme: "Adaptation & Foundation",
    focus: "Master movement patterns and build your base",
    progressionNote: "Focus on perfect form and full range of motion. Record your starting weights \u2014 these are your baseline numbers."
  },
  {
    theme: "Volume Building",
    focus: "Increase total training volume to drive hypertrophy",
    progressionNote: "Add one extra set per compound exercise. Aim for the upper rep range. You should be slightly more fatigued by end of session."
  },
  {
    theme: "Intensity Phase",
    focus: "Heavier loads, maximum muscle recruitment",
    progressionNote: "Increase load by 5\u201310% vs Week 1. You will do fewer reps but with more weight \u2014 this is the growth stimulus."
  },
  {
    theme: "Peak Performance",
    focus: "Maximum output \u2014 test your new strength baseline",
    progressionNote: "This is your peak week. Push for personal bests on main compound lifts. Log every rep \u2014 you'll use these as Week 1 numbers next cycle."
  }
];
function weekProtocol(goal, weekIdx, level) {
  const adv = level === "advanced" ? 1 : 0;
  const table = {
    weight_loss: { sets: [3, 3, 4, 4], reps: ["12\u201315", "15\u201320", "10\u201312", "12\u201315"], rest: ["45 sec", "45 sec", "30 sec", "30 sec"] },
    muscle_gain: { sets: [3, 4, 4, 5], reps: ["10\u201312", "10\u201312", "8\u201310", "6\u20138"], rest: ["60 sec", "60 sec", "75 sec", "90 sec"] },
    strength: { sets: [4, 4, 5, 5], reps: ["6\u20138", "6\u20138", "4\u20136", "3\u20135"], rest: ["2 min", "2 min", "2.5 min", "3 min"] },
    general_fitness: { sets: [3, 3, 4, 4], reps: ["10\u201312", "12\u201315", "10\u201312", "8\u201312"], rest: ["60 sec", "60 sec", "60 sec", "75 sec"] }
  };
  const t = table[goal] ?? table.general_fitness;
  const w = Math.min(weekIdx, 3);
  return { sets: t.sets[w] + adv, reps: t.reps[w], rest: t.rest[w] };
}
var GYM_EXERCISES = {
  chest: [
    ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Chest Fly"],
    ["Dumbbell Bench Press", "Incline Barbell Press", "Pec Deck Machine"],
    ["Low-Incline Barbell Press", "Weighted Chest Dips", "Cable Crossover"],
    ["Barbell Bench Press (heavy)", "Decline Dumbbell Press", "High-to-Low Cable Fly"]
  ],
  back: [
    ["Pull-Ups", "Barbell Row", "Lat Pulldown"],
    ["Seated Cable Row", "T-Bar Row", "Single-Arm DB Row"],
    ["Chest-Supported Row", "Pendlay Row", "Straight-Arm Pulldown"],
    ["Weighted Pull-Ups", "Heavy Barbell Row", "Face Pulls"]
  ],
  legs: [
    ["Barbell Back Squat", "Leg Press", "Romanian Deadlift", "Leg Curl"],
    ["Bulgarian Split Squat", "Hack Squat", "Sumo Deadlift", "Leg Extension"],
    ["Front Squat", "Leg Press (heavy)", "Nordic Curl", "Walking Lunges"],
    ["Barbell Squat (PR attempt)", "Hack Squat (heavy)", "Romanian Deadlift (heavy)", "Calf Raises"]
  ],
  shoulders: [
    ["Overhead Press", "Lateral Raise", "Rear Delt Fly"],
    ["Arnold Press", "Cable Lateral Raise", "Upright Row"],
    ["Seated DB Press", "Bent-Over Lateral Raise", "Face Pulls"],
    ["Military Press (heavy)", "Lateral Raise Drop Set", "Rear Delt Machine"]
  ],
  triceps: [
    ["Tricep Pushdown", "Overhead Tricep Extension", "Skull Crushers"],
    ["Close-Grip Bench Press", "Cable Kickback", "Tricep Dips"],
    ["Overhead Cable Extension", "Diamond Push-Ups", "Single-Arm Pushdown"],
    ["Weighted Dips", "EZ-Bar Skull Crusher", "Rope Pushdown Drop Set"]
  ],
  biceps: [
    ["Barbell Curl", "Hammer Curl", "Incline DB Curl"],
    ["Preacher Curl", "Cable Curl", "Concentration Curl"],
    ["EZ-Bar Curl", "Reverse Curl", "Cross-Body Hammer Curl"],
    ["Barbell Curl (heavy)", "Cable Rope Hammer Curl", "21s Barbell Curl"]
  ],
  core: [
    ["Plank", "Crunches", "Leg Raises"],
    ["Ab Rollout", "Hanging Knee Raises", "Russian Twists"],
    ["Cable Crunch", "Bicycle Crunches", "Side Plank"],
    ["Weighted Plank", "Hanging Leg Raise", "Dragon Flag Progression"]
  ],
  cardio: [
    ["Treadmill HIIT: 1 min sprint / 1 min walk \xD7 10"],
    ["Rowing Machine: 20 min moderate pace, build each 5 min"],
    ["Stationary Bike Intervals: 30s hard / 30s easy \xD7 12"],
    ["Jump Rope Circuit: 3 \xD7 3 min with 1 min rest"]
  ],
  fullbody: [
    ["Deadlift", "Barbell Back Squat", "Bench Press", "Pull-Ups", "Overhead Press"],
    ["Romanian Deadlift", "Front Squat", "Incline Press", "Pendlay Row", "Push Press"],
    ["Sumo Deadlift", "Goblet Squat", "DB Bench Press", "Lat Pulldown", "Arnold Press"],
    ["Deadlift (PR attempt)", "Squat (PR attempt)", "Push Press", "Weighted Pull-Ups", "Dips"]
  ]
};
var HOME_EXERCISES = {
  chest: [
    ["Push-Ups", "Wide Push-Ups", "Diamond Push-Ups"],
    ["Decline Push-Ups", "Archer Push-Ups", "Slow-Tempo Push-Ups (4-0-4)"],
    ["Explosive Clap Push-Ups", "Staggered Push-Ups", "One-Arm Assisted Push-Ups"],
    ["Push-Up Circuit: Wide + Diamond + Regular", "Plyo Push-Ups", "Pseudo Planche Push-Ups"]
  ],
  back: [
    ["Superman Holds", "Bird-Dog", "Reverse Snow Angels"],
    ["Doorframe Pull-Ups", "Bodyweight Row (table)", "Good Mornings"],
    ["Band Row", "Renegade Row", "Resistance Band Pull-Apart"],
    ["Weighted Pull-Ups (backpack)", "Single-Arm DB Row", "Band Face Pulls"]
  ],
  legs: [
    ["Air Squat", "Reverse Lunges", "Glute Bridge", "Calf Raises"],
    ["Bulgarian Split Squat", "Step-Ups", "Single-Leg Glute Bridge", "Wall Sit"],
    ["Jump Squats", "Walking Lunges", "Nordic Curl", "Pistol Squat Progression"],
    ["Weighted Goblet Squat", "Explosive Split Jumps", "Nordic Curl (3\xD75)", "Pistol Squats"]
  ],
  shoulders: [
    ["Pike Push-Ups", "Band Lateral Raise", "Band Front Raise"],
    ["Handstand Wall Hold", "Band Arnold Press", "Band Rear Delt Fly"],
    ["Decline Pike Push-Ups", "Band Upright Row", "Band Face Pulls"],
    ["Handstand Push-Up Progression", "Band Overhead Press", "Band Pull-Apart Circuit"]
  ],
  triceps: [
    ["Chair Dips", "Diamond Push-Ups", "Close-Grip Push-Ups"],
    ["Bench Dips", "Band Overhead Extension", "Band Kickback"],
    ["Weighted Bench Dips", "Tricep Push-Ups", "Band Pushdown"],
    ["Heavy Bench Dips", "Diamond Drop Set", "Banded Pushdown (slow)"]
  ],
  biceps: [
    ["Band Bicep Curl", "Band Hammer Curl", "Towel Curl"],
    ["Concentration Curl (band)", "Reverse Curl (band)", "Isometric Hold 30 sec"],
    ["DB Curl (if available)", "Band Preacher Curl", "21s (band)"],
    ["DB Curl (heavy)", "Band Hammer Curl Drop Set", "Slow-Tempo Curl 4-1-4"]
  ],
  core: [
    ["Plank", "Crunches", "Leg Raises"],
    ["Mountain Climbers", "Bicycle Crunches", "Reverse Crunch"],
    ["V-Ups", "Side Plank", "Hollow Body Hold"],
    ["Dragon Flag Progression", "L-Sit Hold", "Ab Wheel Rollout"]
  ],
  cardio: [
    ["HIIT: Jumping Jacks + Burpees (30s on / 30s off \xD7 10)"],
    ["Jump Rope Circuit: 3 \xD7 3 min"],
    ["Bodyweight HIIT: Squat Jumps / Mountain Climbers / Burpees, 4 rounds"],
    ["Tabata Sprint: 20s max effort / 10s rest \xD7 8"]
  ],
  fullbody: [
    ["Burpees", "Air Squat", "Push-Ups", "Reverse Lunges", "Plank"],
    ["Squat-to-Press (band)", "Inchworm Walk-Out", "Push-Ups", "Glute Bridge March", "Bear Crawl"],
    ["Jump Squats", "Push-Ups", "Band Row", "Mountain Climbers", "Single-Leg Deadlift"],
    ["Explosive Burpees", "Pistol Squat Progression", "Plyometric Push-Ups", "Band Pull Circuit", "Dragon Flag"]
  ]
};
var SPLITS = {
  2: [
    { focus: "Full Body A", groups: ["fullbody", "core"] },
    { focus: "Full Body B", groups: ["fullbody", "core"] }
  ],
  3: [
    { focus: "Push \u2013 Chest, Shoulders & Triceps", groups: ["chest", "shoulders", "triceps"] },
    { focus: "Pull \u2013 Back & Biceps", groups: ["back", "biceps", "core"] },
    { focus: "Legs & Core", groups: ["legs", "core"] }
  ],
  4: [
    { focus: "Upper A \u2013 Chest & Back", groups: ["chest", "back", "core"] },
    { focus: "Lower A \u2013 Quads & Glutes", groups: ["legs", "core"] },
    { focus: "Upper B \u2013 Shoulders & Arms", groups: ["shoulders", "triceps", "biceps"] },
    { focus: "Lower B \u2013 Hamstrings & Calves", groups: ["legs", "core"] }
  ],
  5: [
    { focus: "Chest & Triceps", groups: ["chest", "triceps"] },
    { focus: "Back & Biceps", groups: ["back", "biceps"] },
    { focus: "Legs", groups: ["legs", "core"] },
    { focus: "Shoulders & Core", groups: ["shoulders", "core"] },
    { focus: "Full Body Conditioning", groups: ["fullbody", "cardio"] }
  ],
  6: [
    { focus: "Push A \u2013 Chest Focus", groups: ["chest", "shoulders", "triceps"] },
    { focus: "Pull A \u2013 Back Emphasis", groups: ["back", "biceps"] },
    { focus: "Legs A \u2013 Quad Drive", groups: ["legs", "core"] },
    { focus: "Push B \u2013 Shoulder Focus", groups: ["shoulders", "chest", "triceps"] },
    { focus: "Pull B \u2013 Biceps & Core", groups: ["back", "biceps", "core"] },
    { focus: "Legs B \u2013 Posterior Chain", groups: ["legs", "core"] }
  ]
};
var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
var INJURY_FILTERS = [
  {
    keywords: ["shoulder", "rotator", "ac joint"],
    blocked: ["overhead press", "arnold press", "front raise", "military press", "upright row", "behind neck", "shoulder press", "pike push-up", "handstand"]
  },
  {
    keywords: ["knee", "patella", "meniscus"],
    blocked: ["squat", "lunge", "leg press", "hack squat", "step-up", "split squat", "pistol", "jump squat", "split jump"]
  },
  {
    keywords: ["lower back", "lumbar", "disc"],
    blocked: ["deadlift", "barbell row", "good morning", "pendlay", "sumo deadlift", "nordic curl"]
  },
  {
    keywords: ["wrist", "carpal"],
    blocked: ["barbell bench", "barbell curl", "push-up", "skull crusher", "clean", "snatch"]
  },
  {
    keywords: ["elbow", "tennis elbow", "golfer"],
    blocked: ["skull crusher", "overhead extension", "close-grip bench", "preacher curl", "reverse curl"]
  }
];
function isBlocked(exerciseName, injuries) {
  const injLower = injuries.toLowerCase();
  const exLower = exerciseName.toLowerCase();
  for (const filter of INJURY_FILTERS) {
    if (filter.keywords.some((k) => injLower.includes(k))) {
      if (filter.blocked.some((b) => exLower.includes(b))) return true;
    }
  }
  return false;
}
function pickExercises(groups, goal, level, weekIdx, location, injuries) {
  const proto = weekProtocol(goal, weekIdx, level);
  const pool = location === "gym" ? GYM_EXERCISES : HOME_EXERCISES;
  const exs = [];
  for (const g of groups) {
    const variants = pool[g];
    if (!variants) continue;
    const weekVariant = variants[weekIdx] ?? variants[0];
    const count = g === "core" ? 2 : g === "cardio" ? 1 : g === "fullbody" ? 5 : 3;
    const allowed = weekVariant.filter((name) => !isBlocked(name, injuries));
    for (let i = 0; i < Math.min(count, allowed.length); i++) {
      const name = allowed[i];
      exs.push({
        name,
        sets: g === "cardio" ? 1 : proto.sets,
        reps: g === "cardio" ? "See notes" : g === "core" ? "12\u201320" : proto.reps,
        rest: g === "cardio" ? "\u2014" : g === "core" ? "30 sec" : proto.rest,
        notes: g === "cardio" ? name : i === 0 ? "Control the eccentric (lowering) phase \u2014 2\u20133 seconds down" : "Full range of motion; pause briefly at the peak contraction"
      });
    }
  }
  return exs;
}
function getTrainingIndices(days) {
  if (days <= 3) return Array.from({ length: days }, (_, i) => i * Math.floor(7 / days));
  if (days === 4) return [0, 1, 3, 4];
  if (days === 5) return [0, 1, 2, 3, 5];
  return [0, 1, 2, 3, 4, 5];
}
function buildWeekSchedule(params) {
  const { fitnessLevel, goal, trainingDays, location, injuries, weekIdx } = params;
  const days = Math.min(Math.max(trainingDays, 2), 6);
  const split = SPLITS[days] ?? SPLITS[3];
  const trainingIndices = getTrainingIndices(days);
  const schedule = [];
  let splitIdx = 0;
  for (let d = 0; d < 7; d++) {
    if (trainingIndices.includes(d)) {
      const s = split[splitIdx % split.length];
      schedule.push({
        day: DAYS[d],
        focus: s.focus,
        type: s.groups.includes("cardio") ? "cardio" : "strength",
        exercises: pickExercises(s.groups, goal, fitnessLevel, weekIdx, location, injuries)
      });
      splitIdx++;
    } else {
      schedule.push({ day: DAYS[d], focus: "Rest & Active Recovery", type: "rest", exercises: [] });
    }
  }
  return schedule;
}
function generate4WeekPlan(params) {
  const { fitnessLevel, goal, trainingDays } = params;
  const location = params.location ?? "gym";
  const injuries = params.injuries ?? "";
  const days = Math.min(Math.max(trainingDays, 2), 6);
  const weeks = WEEK_THEMES.map((theme, weekIdx) => ({
    week: weekIdx + 1,
    theme: theme.theme,
    focus: theme.focus,
    progressionNote: theme.progressionNote,
    schedule: buildWeekSchedule({ fitnessLevel, goal, trainingDays: days, location, injuries, weekIdx })
  }));
  const notes = {
    weight_loss: "Combine with a caloric deficit of 400\u2013500 kcal/day. Keep rest periods short to maintain elevated heart rate. Add 20 min steady-state cardio on rest days for accelerated fat loss.",
    muscle_gain: "Eat in a slight caloric surplus (250\u2013400 kcal). Track progressive overload every week \u2014 aim to add weight or reps each session. Prioritise 7\u20139 hours sleep for maximum recovery.",
    strength: "Focus on heavy compound lifts. Warm up thoroughly with sub-maximal sets. Log all weights and aim to beat personal records by Week 4.",
    general_fitness: "Keep intensity moderate and consistent. Listen to your body. Aim for 7\u20139 hours of sleep. Consistency over 4 weeks beats any single heroic effort."
  };
  const tips = {
    weight_loss: "Target 1.8\u20132.2 g of protein per kg of bodyweight to preserve muscle on the cut. Eat high-volume, low-calorie foods (vegetables, lean protein) to stay satiated.",
    muscle_gain: "Don't skip carbohydrates \u2014 they fuel your workouts and drive muscle recovery. Aim for 4\u20136 g/kg from quality sources: oats, rice, sweet potato, fruit.",
    strength: "Creatine monohydrate (3\u20135 g/day) is the most evidence-backed supplement for strength gains. Take it consistently regardless of training days.",
    general_fitness: "Stay hydrated \u2014 drink at least 35 ml per kg of bodyweight daily. Add ~500 ml for every hour of training."
  };
  const injuryNotes = injuries ? `Injury notes: Based on "${injuries}", certain high-risk exercises have been excluded. If any movement causes pain, stop immediately and consult a physiotherapist.` : void 0;
  return {
    goal,
    fitnessLevel,
    trainingDays: days,
    location,
    weeks,
    warmup: "5\u201310 min light cardio (treadmill jog or bike) + dynamic mobility: leg swings \xD7 10, arm circles \xD7 15, hip circles \xD7 10, inchworms \xD7 5, world's greatest stretch \xD7 5 per side.",
    cooldown: "5 min of static stretching: quad stretch 30 sec, hamstring stretch 30 sec, chest opener 30 sec, shoulder cross-body 30 sec, pigeon pose or figure-4 stretch 45 sec per side.",
    recoveryGuide: "Rest days are growth days. Prioritise 7\u20139 hrs sleep. Light walking, foam rolling, or gentle yoga accelerates recovery without adding fatigue. Avoid training the same muscle group on consecutive days.",
    nutritionTip: tips[goal] ?? tips.general_fitness,
    injuryNotes,
    weeklySchedule: weeks[0].schedule,
    trainingNotes: notes[goal] ?? notes.general_fitness
  };
}
router12.post("/generate", async (req, res) => {
  try {
    const { age, gender, weight, height, fitnessLevel, goal, trainingDays, location, equipment, injuries } = req.body;
    if (!age || !gender || !fitnessLevel || !goal || !trainingDays) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const plan = generate4WeekPlan({
      age: Number(age),
      gender,
      weight: String(weight ?? ""),
      height: String(height ?? ""),
      fitnessLevel,
      goal,
      trainingDays: Number(trainingDays),
      location: location ?? "gym",
      equipment: equipment ?? "full_gym",
      injuries: injuries ?? ""
    });
    res.json({ plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generation failed" });
  }
});
router12.get("/", async (req, res) => {
  try {
    const plans = await db11.select().from(aiWorkoutPlansTable).where(eq10(aiWorkoutPlansTable.gymId, req.gymId));
    res.json(plans.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router12.post("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { memberId, memberName, age, gender, weight, height, fitnessLevel, goal, trainingDays, plan } = req.body;
    if (!memberId || !plan) {
      res.status(400).json({ error: "memberId and plan are required" });
      return;
    }
    const [member] = await db11.select().from(membersTable6).where(and7(eq10(membersTable6.id, Number(memberId)), eq10(membersTable6.gymId, gymId))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const [saved] = await db11.insert(aiWorkoutPlansTable).values({
      gymId,
      memberId: Number(memberId),
      memberName: memberName ?? member.name,
      age: age ? Number(age) : null,
      gender: gender ?? null,
      weightVal: weight ? String(weight) : null,
      heightVal: height ? String(height) : null,
      fitnessLevel: fitnessLevel ?? null,
      goal: goal ?? null,
      trainingDays: trainingDays ? Number(trainingDays) : null,
      plan
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router12.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [member] = await db11.select().from(membersTable6).where(and7(eq10(membersTable6.gymId, gymId), eq10(membersTable6.email, req.userEmail))).limit(1);
    if (!member) {
      res.json([]);
      return;
    }
    const plans = await db11.select().from(aiWorkoutPlansTable).where(and7(eq10(aiWorkoutPlansTable.gymId, gymId), eq10(aiWorkoutPlansTable.memberId, member.id)));
    const reversed = plans.reverse();
    if (reversed.length > 0) {
      const p = reversed[0].plan;
      const weeks = p?.weeks;
      const wk0 = weeks?.[0];
      const sched = wk0?.schedule;
      const day0 = sched?.[0];
      const exs = day0?.exercises;
      console.log(`[ai-workout/me] ${reversed.length} plans; plan keys=${Object.keys(p ?? {}).join(",")}; has weeks=${!!weeks} (${weeks?.length}); wk0 days=${sched?.length}; day0 exs=${exs?.length}; warmup=${!!p?.warmup}`);
    }
    res.json(reversed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router12.post("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [member] = await db11.select().from(membersTable6).where(and7(eq10(membersTable6.gymId, gymId), eq10(membersTable6.email, req.userEmail))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const { age, gender, weight, height, fitnessLevel, goal, trainingDays, plan } = req.body;
    if (!plan) {
      res.status(400).json({ error: "plan is required" });
      return;
    }
    const [saved] = await db11.insert(aiWorkoutPlansTable).values({
      gymId,
      memberId: member.id,
      memberName: member.name,
      age: age ? Number(age) : null,
      gender: gender ?? null,
      weightVal: weight ? String(weight) : null,
      heightVal: height ? String(height) : null,
      fitnessLevel: fitnessLevel ?? null,
      goal: goal ?? null,
      trainingDays: trainingDays ? Number(trainingDays) : null,
      plan
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router12.get("/:id", async (req, res) => {
  try {
    const [plan] = await db11.select().from(aiWorkoutPlansTable).where(and7(eq10(aiWorkoutPlansTable.id, Number(req.params.id)), eq10(aiWorkoutPlansTable.gymId, req.gymId))).limit(1);
    if (!plan) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router12.delete("/:id", async (req, res) => {
  try {
    await db11.delete(aiWorkoutPlansTable).where(and7(eq10(aiWorkoutPlansTable.id, Number(req.params.id)), eq10(aiWorkoutPlansTable.gymId, req.gymId)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var ai_workout_default = router12;

// src/routes/ai-diet.ts
import { Router as Router13 } from "express";
import { db as db12, aiDietPlansTable, membersTable as membersTable7 } from "@workspace/db";
import { eq as eq11, and as and8 } from "drizzle-orm";
var router13 = Router13();
router13.use(requireAuth);
function parseWeight(w) {
  const n = parseFloat(w);
  if (w.toLowerCase().includes("lb")) return n * 0.453592;
  return isNaN(n) ? 70 : n;
}
function parseHeight(h) {
  const ft = h.match(/(\d+)'(\d+)/);
  if (ft) return parseInt(ft[1]) * 30.48 + parseInt(ft[2]) * 2.54;
  const n = parseFloat(h);
  if (isNaN(n)) return 170;
  if (n < 10) return n * 100;
  return n;
}
var ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9
};
function calcMacros(kcal, goal) {
  const ratios = {
    weight_loss: [0.4, 0.35, 0.25],
    muscle_gain: [0.3, 0.5, 0.2],
    strength: [0.35, 0.45, 0.2],
    general_fitness: [0.3, 0.4, 0.3]
  };
  const [pr, ch, fa] = ratios[goal] ?? ratios.general_fitness;
  return {
    protein: Math.round(kcal * pr / 4),
    carbs: Math.round(kcal * ch / 4),
    fats: Math.round(kcal * fa / 9)
  };
}
var STANDARD_TEMPLATES = {
  weight_loss: {
    breakfast: [
      [
        { food: "Egg whites (6)", amount: "180g", calories: 94, protein: 20, carbs: 2, fats: 0 },
        { food: "Oatmeal (dry)", amount: "50g", calories: 190, protein: 7, carbs: 34, fats: 3 },
        { food: "Blueberries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
        { food: "Black coffee", amount: "240ml", calories: 5, protein: 0, carbs: 1, fats: 0 }
      ],
      [
        { food: "Greek yogurt (0%)", amount: "200g", calories: 104, protein: 18, carbs: 7, fats: 1 },
        { food: "Banana", amount: "1 medium", calories: 89, protein: 1, carbs: 23, fats: 0 },
        { food: "Almonds", amount: "20g", calories: 116, protein: 4, carbs: 3, fats: 10 }
      ]
    ],
    lunch: [[
      { food: "Grilled chicken breast", amount: "180g", calories: 297, protein: 56, carbs: 0, fats: 6 },
      { food: "Mixed green salad", amount: "150g", calories: 35, protein: 3, carbs: 6, fats: 0 },
      { food: "Cherry tomatoes", amount: "80g", calories: 14, protein: 1, carbs: 3, fats: 0 },
      { food: "Olive oil dressing", amount: "10ml", calories: 88, protein: 0, carbs: 0, fats: 10 }
    ]],
    dinner: [
      [
        { food: "Salmon fillet", amount: "160g", calories: 331, protein: 36, carbs: 0, fats: 20 },
        { food: "Steamed broccoli", amount: "200g", calories: 68, protein: 6, carbs: 13, fats: 1 },
        { food: "Cauliflower rice", amount: "150g", calories: 38, protein: 3, carbs: 8, fats: 0 }
      ],
      [
        { food: "Lean ground turkey (93%)", amount: "180g", calories: 234, protein: 36, carbs: 0, fats: 9 },
        { food: "Stir-fry vegetables", amount: "200g", calories: 80, protein: 5, carbs: 16, fats: 1 },
        { food: "Brown rice (cooked)", amount: "100g", calories: 111, protein: 3, carbs: 23, fats: 1 }
      ]
    ],
    snacks: [[
      { food: "Whey protein shake", amount: "1 scoop / 300ml water", calories: 130, protein: 25, carbs: 5, fats: 2 },
      { food: "Celery sticks", amount: "100g", calories: 14, protein: 1, carbs: 3, fats: 0 }
    ]]
  },
  muscle_gain: {
    breakfast: [[
      { food: "Whole eggs", amount: "3 large", calories: 213, protein: 18, carbs: 2, fats: 15 },
      { food: "Oatmeal (dry)", amount: "80g", calories: 304, protein: 11, carbs: 54, fats: 5 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
      { food: "Whole milk", amount: "200ml", calories: 122, protein: 7, carbs: 10, fats: 7 }
    ]],
    lunch: [[
      { food: "Chicken breast", amount: "220g", calories: 363, protein: 68, carbs: 0, fats: 8 },
      { food: "White rice (cooked)", amount: "200g", calories: 260, protein: 5, carbs: 57, fats: 0 },
      { food: "Avocado", amount: "\xBD fruit", calories: 120, protein: 2, carbs: 6, fats: 11 },
      { food: "Broccoli", amount: "150g", calories: 51, protein: 4, carbs: 10, fats: 1 }
    ]],
    dinner: [[
      { food: "Sirloin steak (lean)", amount: "200g", calories: 342, protein: 52, carbs: 0, fats: 14 },
      { food: "Sweet potato (baked)", amount: "250g", calories: 215, protein: 4, carbs: 50, fats: 0 },
      { food: "Asparagus", amount: "150g", calories: 34, protein: 4, carbs: 6, fats: 0 },
      { food: "Olive oil", amount: "10ml", calories: 88, protein: 0, carbs: 0, fats: 10 }
    ]],
    snacks: [[
      { food: "Mass gainer / Protein shake", amount: "1 serving", calories: 280, protein: 30, carbs: 30, fats: 5 },
      { food: "Peanut butter", amount: "30g", calories: 188, protein: 8, carbs: 6, fats: 16 },
      { food: "Rice cakes", amount: "2 cakes", calories: 70, protein: 1, carbs: 16, fats: 0 }
    ]]
  },
  strength: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Sourdough toast", amount: "2 slices", calories: 200, protein: 8, carbs: 38, fats: 2 },
      { food: "Smoked salmon", amount: "80g", calories: 130, protein: 18, carbs: 0, fats: 6 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 }
    ]],
    lunch: [[
      { food: "Lean beef mince (10% fat)", amount: "200g", calories: 320, protein: 44, carbs: 0, fats: 14 },
      { food: "Pasta (cooked)", amount: "200g", calories: 260, protein: 9, carbs: 52, fats: 2 },
      { food: "Tomato sauce", amount: "100g", calories: 35, protein: 2, carbs: 8, fats: 0 },
      { food: "Parmesan", amount: "20g", calories: 79, protein: 7, carbs: 1, fats: 5 }
    ]],
    dinner: [[
      { food: "Salmon fillet", amount: "200g", calories: 414, protein: 45, carbs: 0, fats: 25 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Roasted mixed vegetables", amount: "200g", calories: 100, protein: 4, carbs: 20, fats: 2 }
    ]],
    snacks: [[
      { food: "Protein shake + creatine", amount: "1 scoop + 5g", calories: 140, protein: 26, carbs: 5, fats: 2 },
      { food: "Mixed nuts", amount: "40g", calories: 240, protein: 8, carbs: 8, fats: 20 }
    ]]
  },
  general_fitness: {
    breakfast: [[
      { food: "Greek yogurt (full-fat)", amount: "200g", calories: 130, protein: 17, carbs: 9, fats: 3 },
      { food: "Mixed berries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
      { food: "Granola", amount: "40g", calories: 179, protein: 4, carbs: 28, fats: 6 },
      { food: "Orange", amount: "1 medium", calories: 62, protein: 1, carbs: 15, fats: 0 }
    ]],
    lunch: [[
      { food: "Grilled chicken", amount: "180g", calories: 297, protein: 56, carbs: 0, fats: 6 },
      { food: "Mixed salad", amount: "150g", calories: 35, protein: 3, carbs: 6, fats: 0 },
      { food: "Brown rice (cooked)", amount: "150g", calories: 167, protein: 4, carbs: 35, fats: 1 },
      { food: "Hummus", amount: "50g", calories: 118, protein: 4, carbs: 10, fats: 7 }
    ]],
    dinner: [[
      { food: "Baked cod fillet", amount: "180g", calories: 189, protein: 41, carbs: 0, fats: 2 },
      { food: "Sweet potato mash", amount: "200g", calories: 172, protein: 3, carbs: 40, fats: 0 },
      { food: "Green beans", amount: "150g", calories: 53, protein: 3, carbs: 12, fats: 0 },
      { food: "Olive oil drizzle", amount: "5ml", calories: 44, protein: 0, carbs: 0, fats: 5 }
    ]],
    snacks: [[
      { food: "Apple", amount: "1 medium", calories: 95, protein: 0, carbs: 25, fats: 0 },
      { food: "String cheese", amount: "28g", calories: 80, protein: 7, carbs: 1, fats: 5 }
    ]]
  }
};
var VEGETARIAN_TEMPLATES = {
  weight_loss: {
    breakfast: [[
      { food: "Scrambled eggs (3)", amount: "150g", calories: 195, protein: 18, carbs: 2, fats: 14 },
      { food: "Oatmeal (dry)", amount: "50g", calories: 190, protein: 7, carbs: 34, fats: 3 },
      { food: "Mixed berries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 }
    ]],
    lunch: [[
      { food: "Paneer (low-fat)", amount: "150g", calories: 246, protein: 18, carbs: 4, fats: 18 },
      { food: "Mixed salad", amount: "200g", calories: 40, protein: 3, carbs: 7, fats: 0 },
      { food: "Chickpeas (cooked)", amount: "100g", calories: 164, protein: 9, carbs: 27, fats: 3 },
      { food: "Lemon-tahini dressing", amount: "15g", calories: 90, protein: 3, carbs: 3, fats: 8 }
    ]],
    dinner: [[
      { food: "Lentil soup", amount: "300g", calories: 230, protein: 18, carbs: 38, fats: 2 },
      { food: "Steamed broccoli", amount: "200g", calories: 68, protein: 6, carbs: 13, fats: 1 },
      { food: "Brown rice (cooked)", amount: "80g", calories: 89, protein: 2, carbs: 19, fats: 1 }
    ]],
    snacks: [[
      { food: "Whey protein shake", amount: "1 scoop / 300ml milk", calories: 200, protein: 30, carbs: 12, fats: 3 },
      { food: "Cucumber sticks", amount: "100g", calories: 15, protein: 1, carbs: 3, fats: 0 }
    ]]
  },
  muscle_gain: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Oatmeal (dry)", amount: "80g", calories: 304, protein: 11, carbs: 54, fats: 5 },
      { food: "Whole milk", amount: "200ml", calories: 122, protein: 7, carbs: 10, fats: 7 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 }
    ]],
    lunch: [[
      { food: "Cottage cheese (full-fat)", amount: "200g", calories: 206, protein: 25, carbs: 8, fats: 9 },
      { food: "Brown rice (cooked)", amount: "200g", calories: 222, protein: 5, carbs: 46, fats: 2 },
      { food: "Black beans (cooked)", amount: "150g", calories: 227, protein: 15, carbs: 41, fats: 1 },
      { food: "Avocado", amount: "\xBD fruit", calories: 120, protein: 2, carbs: 6, fats: 11 }
    ]],
    dinner: [[
      { food: "Paneer tikka", amount: "200g", calories: 340, protein: 24, carbs: 6, fats: 25 },
      { food: "Sweet potato (baked)", amount: "250g", calories: 215, protein: 4, carbs: 50, fats: 0 },
      { food: "Spinach saut\xE9", amount: "150g", calories: 55, protein: 5, carbs: 8, fats: 1 }
    ]],
    snacks: [[
      { food: "Whey protein + whole milk", amount: "1 scoop + 300ml", calories: 280, protein: 34, carbs: 18, fats: 8 },
      { food: "Peanut butter on rice cakes", amount: "30g pb + 2 cakes", calories: 258, protein: 9, carbs: 22, fats: 16 }
    ]]
  },
  strength: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Whole-grain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Cheese (cheddar)", amount: "40g", calories: 164, protein: 10, carbs: 0, fats: 14 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 }
    ]],
    lunch: [[
      { food: "Greek yogurt (full-fat)", amount: "200g", calories: 160, protein: 14, carbs: 10, fats: 7 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Chickpeas (roasted)", amount: "100g", calories: 164, protein: 9, carbs: 27, fats: 3 },
      { food: "Feta cheese", amount: "30g", calories: 80, protein: 5, carbs: 1, fats: 6 }
    ]],
    dinner: [[
      { food: "Tempeh", amount: "200g", calories: 380, protein: 41, carbs: 22, fats: 18 },
      { food: "Stir-fry vegetables", amount: "200g", calories: 80, protein: 5, carbs: 16, fats: 1 },
      { food: "Brown rice (cooked)", amount: "180g", calories: 200, protein: 4, carbs: 42, fats: 1 }
    ]],
    snacks: [[
      { food: "Protein shake (whey) + creatine", amount: "1 scoop + 5g", calories: 140, protein: 26, carbs: 5, fats: 2 },
      { food: "Mixed nuts", amount: "40g", calories: 240, protein: 8, carbs: 8, fats: 20 }
    ]]
  },
  general_fitness: {
    breakfast: [[
      { food: "Poached eggs (2)", amount: "100g", calories: 130, protein: 12, carbs: 1, fats: 9 },
      { food: "Wholegrain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Avocado", amount: "\xBD fruit", calories: 120, protein: 2, carbs: 6, fats: 11 },
      { food: "Orange", amount: "1 medium", calories: 62, protein: 1, carbs: 15, fats: 0 }
    ]],
    lunch: [[
      { food: "Caprese salad (mozzarella + tomato)", amount: "200g", calories: 220, protein: 14, carbs: 10, fats: 14 },
      { food: "Lentil soup", amount: "250g", calories: 192, protein: 15, carbs: 32, fats: 2 },
      { food: "Crusty bread", amount: "1 slice", calories: 80, protein: 3, carbs: 16, fats: 1 }
    ]],
    dinner: [[
      { food: "Vegetable curry", amount: "300g", calories: 210, protein: 8, carbs: 34, fats: 6 },
      { food: "Basmati rice (cooked)", amount: "150g", calories: 195, protein: 4, carbs: 42, fats: 0 },
      { food: "Greek yogurt raita", amount: "80g", calories: 52, protein: 4, carbs: 5, fats: 2 }
    ]],
    snacks: [[
      { food: "Apple", amount: "1 medium", calories: 95, protein: 0, carbs: 25, fats: 0 },
      { food: "Cottage cheese", amount: "100g", calories: 103, protein: 13, carbs: 4, fats: 5 }
    ]]
  }
};
var VEGAN_TEMPLATES = {
  weight_loss: {
    breakfast: [[
      { food: "Tofu scramble", amount: "200g", calories: 160, protein: 18, carbs: 4, fats: 9 },
      { food: "Oatmeal (dry) + almond milk", amount: "50g + 200ml", calories: 250, protein: 8, carbs: 40, fats: 5 },
      { food: "Blueberries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 }
    ]],
    lunch: [[
      { food: "Lentil & spinach salad", amount: "300g", calories: 260, protein: 18, carbs: 40, fats: 4 },
      { food: "Cucumber & cherry tomatoes", amount: "150g", calories: 25, protein: 1, carbs: 5, fats: 0 },
      { food: "Tahini dressing", amount: "15g", calories: 90, protein: 3, carbs: 3, fats: 8 }
    ]],
    dinner: [[
      { food: "Chickpea & vegetable stew", amount: "350g", calories: 280, protein: 15, carbs: 48, fats: 5 },
      { food: "Brown rice (cooked)", amount: "120g", calories: 134, protein: 3, carbs: 28, fats: 1 },
      { food: "Kale chips", amount: "50g", calories: 50, protein: 4, carbs: 8, fats: 1 }
    ]],
    snacks: [[
      { food: "Pea protein shake (water)", amount: "1 scoop", calories: 120, protein: 24, carbs: 3, fats: 2 },
      { food: "Celery + almond butter", amount: "100g + 15g", calories: 108, protein: 3, carbs: 7, fats: 8 }
    ]]
  },
  muscle_gain: {
    breakfast: [[
      { food: "Pea protein smoothie (oat milk)", amount: "1 scoop + 400ml", calories: 280, protein: 28, carbs: 28, fats: 6 },
      { food: "Oatmeal (dry)", amount: "80g", calories: 304, protein: 11, carbs: 54, fats: 5 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
      { food: "Chia seeds", amount: "20g", calories: 97, protein: 3, carbs: 8, fats: 6 }
    ]],
    lunch: [[
      { food: "Tempeh (marinated)", amount: "200g", calories: 380, protein: 41, carbs: 22, fats: 18 },
      { food: "Brown rice (cooked)", amount: "200g", calories: 222, protein: 5, carbs: 46, fats: 2 },
      { food: "Edamame", amount: "100g", calories: 121, protein: 11, carbs: 9, fats: 5 },
      { food: "Sesame oil drizzle", amount: "5ml", calories: 40, protein: 0, carbs: 0, fats: 4 }
    ]],
    dinner: [[
      { food: "Black bean burgers", amount: "2 patties", calories: 360, protein: 24, carbs: 52, fats: 8 },
      { food: "Sweet potato fries (baked)", amount: "200g", calories: 172, protein: 3, carbs: 40, fats: 1 },
      { food: "Avocado", amount: "1 whole", calories: 240, protein: 3, carbs: 13, fats: 22 }
    ]],
    snacks: [[
      { food: "Pea protein shake (oat milk)", amount: "1 scoop + 300ml", calories: 230, protein: 26, carbs: 20, fats: 5 },
      { food: "Mixed nuts & dried fruit", amount: "50g", calories: 265, protein: 7, carbs: 22, fats: 17 }
    ]]
  },
  strength: {
    breakfast: [[
      { food: "Tofu scramble with nutritional yeast", amount: "250g", calories: 220, protein: 26, carbs: 8, fats: 10 },
      { food: "Whole-grain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Almond butter", amount: "20g", calories: 122, protein: 4, carbs: 4, fats: 11 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 }
    ]],
    lunch: [[
      { food: "Lentil bolognese", amount: "300g", calories: 320, protein: 24, carbs: 50, fats: 5 },
      { food: "Pasta (wholewheat, cooked)", amount: "200g", calories: 280, protein: 12, carbs: 54, fats: 3 },
      { food: "Nutritional yeast", amount: "10g", calories: 45, protein: 8, carbs: 5, fats: 1 }
    ]],
    dinner: [[
      { food: "Tempeh stir-fry", amount: "200g", calories: 380, protein: 41, carbs: 22, fats: 18 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Mixed stir-fry vegetables", amount: "200g", calories: 80, protein: 5, carbs: 16, fats: 1 }
    ]],
    snacks: [[
      { food: "Pea protein shake (water) + creatine", amount: "1 scoop + 5g", calories: 125, protein: 25, carbs: 4, fats: 2 },
      { food: "Walnuts & dark chocolate", amount: "30g + 20g", calories: 280, protein: 5, carbs: 14, fats: 22 }
    ]]
  },
  general_fitness: {
    breakfast: [[
      { food: "Overnight oats (oat milk)", amount: "80g + 200ml", calories: 310, protein: 10, carbs: 54, fats: 7 },
      { food: "Mixed berries", amount: "100g", calories: 57, protein: 1, carbs: 14, fats: 0 },
      { food: "Flaxseeds", amount: "15g", calories: 81, protein: 3, carbs: 4, fats: 6 }
    ]],
    lunch: [[
      { food: "Buddha bowl (chickpeas + quinoa)", amount: "350g", calories: 420, protein: 20, carbs: 60, fats: 12 },
      { food: "Tahini & lemon dressing", amount: "20g", calories: 120, protein: 4, carbs: 4, fats: 10 },
      { food: "Cucumber & radish", amount: "100g", calories: 15, protein: 1, carbs: 3, fats: 0 }
    ]],
    dinner: [[
      { food: "Thai green lentil curry", amount: "300g", calories: 290, protein: 18, carbs: 46, fats: 5 },
      { food: "Jasmine rice (cooked)", amount: "150g", calories: 195, protein: 4, carbs: 42, fats: 0 },
      { food: "Coconut cream (2 tbsp)", amount: "30g", calories: 66, protein: 1, carbs: 2, fats: 7 }
    ]],
    snacks: [[
      { food: "Apple with almond butter", amount: "1 medium + 20g", calories: 217, protein: 4, carbs: 33, fats: 11 },
      { food: "Edamame (shelled)", amount: "80g", calories: 97, protein: 9, carbs: 7, fats: 4 }
    ]]
  }
};
var HALAL_TEMPLATES = {
  weight_loss: {
    breakfast: [[
      { food: "Egg whites (6)", amount: "180g", calories: 94, protein: 20, carbs: 2, fats: 0 },
      { food: "Oatmeal (dry)", amount: "50g", calories: 190, protein: 7, carbs: 34, fats: 3 },
      { food: "Dates", amount: "2 pieces", calories: 66, protein: 1, carbs: 18, fats: 0 },
      { food: "Black coffee", amount: "240ml", calories: 5, protein: 0, carbs: 1, fats: 0 }
    ]],
    lunch: [[
      { food: "Grilled halal chicken breast", amount: "180g", calories: 297, protein: 56, carbs: 0, fats: 6 },
      { food: "Tabbouleh salad", amount: "150g", calories: 120, protein: 4, carbs: 18, fats: 4 },
      { food: "Cherry tomatoes", amount: "80g", calories: 14, protein: 1, carbs: 3, fats: 0 },
      { food: "Olive oil & lemon dressing", amount: "10ml", calories: 88, protein: 0, carbs: 0, fats: 10 }
    ]],
    dinner: [[
      { food: "Halal lamb (lean)", amount: "160g", calories: 290, protein: 38, carbs: 0, fats: 15 },
      { food: "Roasted cauliflower", amount: "200g", calories: 66, protein: 5, carbs: 13, fats: 1 },
      { food: "Bulgur wheat (cooked)", amount: "100g", calories: 83, protein: 3, carbs: 19, fats: 0 }
    ]],
    snacks: [[
      { food: "Whey protein shake (halal-certified)", amount: "1 scoop / 300ml water", calories: 130, protein: 25, carbs: 5, fats: 2 },
      { food: "Mixed nuts", amount: "25g", calories: 150, protein: 4, carbs: 6, fats: 12 }
    ]]
  },
  muscle_gain: {
    breakfast: [[
      { food: "Whole eggs", amount: "3 large", calories: 213, protein: 18, carbs: 2, fats: 15 },
      { food: "Oatmeal with honey", amount: "80g + 10g", calories: 344, protein: 11, carbs: 65, fats: 5 },
      { food: "Banana", amount: "1 large", calories: 121, protein: 1, carbs: 31, fats: 0 },
      { food: "Whole milk", amount: "200ml", calories: 122, protein: 7, carbs: 10, fats: 7 }
    ]],
    lunch: [[
      { food: "Halal chicken breast", amount: "220g", calories: 363, protein: 68, carbs: 0, fats: 8 },
      { food: "White rice (cooked)", amount: "200g", calories: 260, protein: 5, carbs: 57, fats: 0 },
      { food: "Lentil dal", amount: "150g", calories: 173, protein: 12, carbs: 30, fats: 1 },
      { food: "Broccoli", amount: "150g", calories: 51, protein: 4, carbs: 10, fats: 1 }
    ]],
    dinner: [[
      { food: "Halal beef steak (lean)", amount: "200g", calories: 342, protein: 52, carbs: 0, fats: 14 },
      { food: "Sweet potato (baked)", amount: "250g", calories: 215, protein: 4, carbs: 50, fats: 0 },
      { food: "Spinach with olive oil", amount: "150g + 5ml", calories: 78, protein: 5, carbs: 7, fats: 5 }
    ]],
    snacks: [[
      { food: "Halal whey protein + milk", amount: "1 scoop + 300ml", calories: 280, protein: 33, carbs: 18, fats: 8 },
      { food: "Date & nut energy balls", amount: "2 pieces", calories: 180, protein: 4, carbs: 26, fats: 8 }
    ]]
  },
  strength: {
    breakfast: [[
      { food: "Whole eggs", amount: "4 large", calories: 284, protein: 24, carbs: 2, fats: 20 },
      { food: "Whole-grain toast", amount: "2 slices", calories: 180, protein: 8, carbs: 34, fats: 3 },
      { food: "Halal turkey slices", amount: "80g", calories: 108, protein: 20, carbs: 2, fats: 2 },
      { food: "Orange juice", amount: "200ml", calories: 88, protein: 1, carbs: 21, fats: 0 }
    ]],
    lunch: [[
      { food: "Halal beef mince (10%)", amount: "200g", calories: 320, protein: 44, carbs: 0, fats: 14 },
      { food: "Pasta (cooked)", amount: "200g", calories: 260, protein: 9, carbs: 52, fats: 2 },
      { food: "Tomato-based sauce", amount: "100g", calories: 35, protein: 2, carbs: 8, fats: 0 },
      { food: "Parmesan", amount: "20g", calories: 79, protein: 7, carbs: 1, fats: 5 }
    ]],
    dinner: [[
      { food: "Halal salmon fillet", amount: "200g", calories: 414, protein: 45, carbs: 0, fats: 25 },
      { food: "Quinoa (cooked)", amount: "200g", calories: 240, protein: 9, carbs: 43, fats: 4 },
      { food: "Roasted root vegetables", amount: "200g", calories: 100, protein: 4, carbs: 20, fats: 2 }
    ]],
    snacks: [[
      { food: "Halal protein shake + creatine", amount: "1 scoop + 5g", calories: 140, protein: 26, carbs: 5, fats: 2 },
      { food: "Mixed nuts & raisins", amount: "40g", calories: 210, protein: 5, carbs: 18, fats: 13 }
    ]]
  },
  general_fitness: {
    breakfast: [[
      { food: "Foul medames (fava beans)", amount: "200g", calories: 186, protein: 14, carbs: 32, fats: 1 },
      { food: "Poached egg (2)", amount: "100g", calories: 130, protein: 12, carbs: 1, fats: 9 },
      { food: "Wholegrain pitta", amount: "1 piece", calories: 150, protein: 5, carbs: 29, fats: 2 },
      { food: "Olive oil drizzle", amount: "5ml", calories: 44, protein: 0, carbs: 0, fats: 5 }
    ]],
    lunch: [[
      { food: "Halal chicken shawarma wrap", amount: "1 wrap", calories: 380, protein: 34, carbs: 38, fats: 10 },
      { food: "Hummus", amount: "50g", calories: 118, protein: 4, carbs: 10, fats: 7 },
      { food: "Tabouli salad", amount: "100g", calories: 80, protein: 3, carbs: 12, fats: 3 }
    ]],
    dinner: [[
      { food: "Halal lamb kofta", amount: "180g", calories: 310, protein: 30, carbs: 6, fats: 18 },
      { food: "Basmati rice (cooked)", amount: "150g", calories: 195, protein: 4, carbs: 42, fats: 0 },
      { food: "Cucumber-yogurt dip (labneh)", amount: "80g", calories: 70, protein: 4, carbs: 4, fats: 4 }
    ]],
    snacks: [[
      { food: "Dates & almonds", amount: "3 dates + 20g almonds", calories: 215, protein: 4, carbs: 38, fats: 11 },
      { food: "Greek yogurt", amount: "150g", calories: 97, protein: 13, carbs: 7, fats: 2 }
    ]]
  }
};
function getTemplates(dietaryPreference) {
  if (dietaryPreference === "vegetarian") return VEGETARIAN_TEMPLATES;
  if (dietaryPreference === "vegan") return VEGAN_TEMPLATES;
  if (dietaryPreference === "halal") return HALAL_TEMPLATES;
  return STANDARD_TEMPLATES;
}
function scaleMeal(items, targetKcal) {
  const baseKcal = items.reduce((s, i) => s + i.calories, 0);
  const factor = baseKcal > 0 ? targetKcal / baseKcal : 1;
  const scaled = items.map((i) => ({
    ...i,
    calories: Math.round(i.calories * factor),
    protein: Math.round(i.protein * factor),
    carbs: Math.round(i.carbs * factor),
    fats: Math.round(i.fats * factor)
  }));
  return {
    items: scaled,
    calories: Math.round(targetKcal),
    protein: scaled.reduce((s, i) => s + i.protein, 0)
  };
}
function generateDietPlan(params) {
  const { age, gender, goal } = params;
  const activityLevel = params.activityLevel ?? "moderately_active";
  const dietaryPreference = params.dietaryPreference ?? "standard";
  const wKg = parseWeight(params.weight);
  const hCm = parseHeight(params.height);
  let bmr = 10 * wKg + 6.25 * hCm - 5 * age;
  bmr += gender === "male" ? 5 : -161;
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  const tdee = bmr * multiplier;
  let kcal = tdee;
  if (goal === "weight_loss") kcal = tdee - 500;
  if (goal === "muscle_gain") kcal = tdee + 300;
  kcal = Math.round(Math.max(1400, kcal));
  const bmi = hCm > 0 ? Math.round(wKg / (hCm / 100) ** 2 * 10) / 10 : void 0;
  const { protein, carbs, fats } = calcMacros(kcal, goal);
  const templates = getTemplates(dietaryPreference);
  const tpl = templates[goal] ?? templates.general_fitness;
  const v = Math.round(Math.random());
  const bfRaw = tpl.breakfast[v] ?? tpl.breakfast[0];
  const luRaw = tpl.lunch[0];
  const diRaw = tpl.dinner[v] ?? tpl.dinner[0];
  const snRaw = tpl.snacks[0];
  const bfKcal = Math.round(kcal * 0.25);
  const luKcal = Math.round(kcal * 0.35);
  const diKcal = Math.round(kcal * 0.3);
  const snKcal = kcal - bfKcal - luKcal - diKcal;
  const bf = scaleMeal(bfRaw, bfKcal);
  const lu = scaleMeal(luRaw, luKcal);
  const di = scaleMeal(diRaw, diKcal);
  const sn = scaleMeal(snRaw, snKcal);
  const hydration = wKg > 0 ? `${Math.round(wKg * 0.035 * 10) / 10}\u2013${Math.round(wKg * 0.04 * 10) / 10} litres per day. Add ~500ml for every hour of training. Start your morning with a large glass before anything else.` : "2.5\u20133.5 litres per day. Adjust upward based on training intensity and climate.";
  const prefLabel = {
    standard: "Standard",
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    halal: "Halal"
  };
  const actLabel = {
    sedentary: "Sedentary",
    lightly_active: "Lightly Active",
    moderately_active: "Moderately Active",
    very_active: "Very Active",
    extra_active: "Extra Active"
  };
  const notes = {
    weight_loss: "Aim for a consistent 400\u2013500 kcal daily deficit. High protein intake preserves lean muscle while losing fat. Sustainable loss is 0.5\u20131 kg/week \u2014 avoid crash dieting.",
    muscle_gain: "Eat in a controlled surplus and time carbohydrates around workouts (1\u20132 hrs pre/post). Don't neglect vegetables and micronutrients.",
    strength: "Pre-workout meals should be carb-rich for fuel. Post-workout protein within 30\u201360 min of finishing your session is critical.",
    general_fitness: "Balance is key. Enjoy a wide variety of whole foods, minimise ultra-processed products, and don't obsess over exact numbers."
  };
  const tips = {
    weight_loss: ["Track calories for at least 2 weeks to build awareness", "Eat slowly \u2014 wait 20 min before going for seconds", "Replace sugary drinks with water, black coffee, or herbal tea", "Prioritise sleep \u2014 poor sleep dramatically increases hunger hormones"],
    muscle_gain: ["Don't skip carbs \u2014 they're your muscles' primary fuel source", "Eat within 60 min post-workout for optimal muscle protein synthesis", "Creatine monohydrate (5g/day) is proven to enhance strength and muscle mass", "Progressive overload drives muscle growth \u2014 nutrition supports and amplifies it"],
    strength: ["Carbohydrates are critical for maximal strength output \u2014 don't cut them", "Time your largest carb-rich meal 2\u20133 hours before training", "Consider creatine (5g/day) and beta-alanine for performance support", "Adequate rest between sessions is a non-negotiable part of the programme"],
    general_fitness: ["Cook more meals at home \u2014 healthier, cheaper, and more satisfying", "The 80/20 rule: eat well 80% of the time and don't stress the rest", "Variety in your diet ensures you get the full spectrum of micronutrients", "Stay consistent rather than perfect \u2014 habits beat willpower long-term"]
  };
  return {
    dailyCalories: kcal,
    protein,
    carbs,
    fats,
    hydration,
    bmi,
    dietaryPreference: prefLabel[dietaryPreference] ?? dietaryPreference,
    activityLevel: actLabel[activityLevel] ?? activityLevel,
    breakfast: { name: "Breakfast", time: "7:00 \u2013 8:00 AM", calories: bf.calories, protein: bf.protein, items: bf.items },
    lunch: { name: "Lunch", time: "12:00 \u2013 1:00 PM", calories: lu.calories, protein: lu.protein, items: lu.items },
    dinner: { name: "Dinner", time: "6:30 \u2013 7:30 PM", calories: di.calories, protein: di.protein, items: di.items },
    snacks: { name: "Snacks", time: "10:00 AM & 3:30 PM", calories: sn.calories, protein: sn.protein, items: sn.items },
    notes: notes[goal] ?? notes.general_fitness,
    tips: tips[goal] ?? tips.general_fitness
  };
}
router13.post("/generate", async (req, res) => {
  try {
    const { age, gender, weight, height, goal, activityLevel, dietaryPreference } = req.body;
    if (!age || !gender || !goal) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const plan = generateDietPlan({
      age: Number(age),
      gender,
      weight: String(weight || "70kg"),
      height: String(height || "170cm"),
      goal,
      activityLevel: activityLevel ?? "moderately_active",
      dietaryPreference: dietaryPreference ?? "standard"
    });
    res.json({ plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generation failed" });
  }
});
router13.get("/", async (req, res) => {
  try {
    const plans = await db12.select().from(aiDietPlansTable).where(eq11(aiDietPlansTable.gymId, req.gymId));
    res.json(plans.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router13.post("/", async (req, res) => {
  try {
    const gymId = req.gymId;
    const { memberId, memberName, age, gender, weight, height, goal, plan } = req.body;
    if (!memberId || !plan) {
      res.status(400).json({ error: "memberId and plan are required" });
      return;
    }
    const [member] = await db12.select().from(membersTable7).where(and8(eq11(membersTable7.id, Number(memberId)), eq11(membersTable7.gymId, gymId))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const [saved] = await db12.insert(aiDietPlansTable).values({
      gymId,
      memberId: Number(memberId),
      memberName: memberName ?? member.name,
      age: age ? Number(age) : null,
      gender: gender ?? null,
      weightVal: weight ? String(weight) : null,
      heightVal: height ? String(height) : null,
      goal: goal ?? null,
      plan
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router13.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [member] = await db12.select().from(membersTable7).where(and8(eq11(membersTable7.gymId, gymId), eq11(membersTable7.email, req.userEmail))).limit(1);
    if (!member) {
      res.json([]);
      return;
    }
    const plans = await db12.select().from(aiDietPlansTable).where(and8(eq11(aiDietPlansTable.gymId, gymId), eq11(aiDietPlansTable.memberId, member.id)));
    res.json(plans.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router13.post("/me", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [member] = await db12.select().from(membersTable7).where(and8(eq11(membersTable7.gymId, gymId), eq11(membersTable7.email, req.userEmail))).limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    const { age, gender, weight, height, goal, plan } = req.body;
    if (!plan) {
      res.status(400).json({ error: "plan is required" });
      return;
    }
    const [saved] = await db12.insert(aiDietPlansTable).values({
      gymId,
      memberId: member.id,
      memberName: member.name,
      age: age ? Number(age) : null,
      gender: gender ?? null,
      weightVal: weight ? String(weight) : null,
      heightVal: height ? String(height) : null,
      goal: goal ?? null,
      plan
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router13.get("/:id", async (req, res) => {
  try {
    const [plan] = await db12.select().from(aiDietPlansTable).where(and8(eq11(aiDietPlansTable.id, Number(req.params.id)), eq11(aiDietPlansTable.gymId, req.gymId))).limit(1);
    if (!plan) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router13.delete("/:id", async (req, res) => {
  try {
    await db12.delete(aiDietPlansTable).where(and8(eq11(aiDietPlansTable.id, Number(req.params.id)), eq11(aiDietPlansTable.gymId, req.gymId)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
var ai_diet_default = router13;

// src/routes/gym.ts
import { Router as Router14 } from "express";
import { db as db13, gymsTable as gymsTable5, membersTable as membersTable8 } from "@workspace/db";
import { eq as eq12 } from "drizzle-orm";
var router14 = Router14();
router14.use(requireAuth);
router14.get("/info", async (req, res) => {
  try {
    const gymId = req.gymId;
    const [gym] = await db13.select().from(gymsTable5).where(eq12(gymsTable5.id, gymId)).limit(1);
    if (!gym) {
      res.status(404).json({ error: "Gym not found" });
      return;
    }
    const members = await db13.select().from(membersTable8).where(eq12(membersTable8.gymId, gymId));
    res.json({
      plan: gym.plan,
      memberLimit: gym.memberLimit,
      memberCount: members.length,
      subscriptionExpiry: gym.subscriptionExpiry,
      status: gym.status
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gym/info]", msg);
    res.status(500).json({ error: "Internal server error" });
  }
});
var gym_default = router14;

// src/index.ts
var __dirname = path2.dirname(fileURLToPath(import.meta.url));
var app = express();
var PORT = Number(process.env.PORT) || 8080;
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "2mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
var uploadsDir = path2.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));
app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", auth_default);
app.use("/api/members", members_default);
app.use("/api/attendance", attendance_default);
app.use("/api/payments", payments_default);
app.use("/api/workout-plans", workout_plans_default);
app.use("/api/branding", branding_default);
app.use("/api/dashboard", dashboard_default);
app.use("/api/platform-admin", platform_admin_default);
app.use("/api/notifications", notifications_default);
app.use("/api/upload", upload_default);
app.use("/api/gym-applications", gym_applications_default);
app.use("/api/ai-workout", ai_workout_default);
app.use("/api/ai-diet", ai_diet_default);
app.use("/api/gym", gym_default);
var distPath = path2.resolve(__dirname, "../../gym-app/dist/public");
if (fs2.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path2.join(distPath, "index.html"));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
}
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on port ${PORT}`);
});
var index_default = app;
export {
  index_default as default
};
//# sourceMappingURL=index.mjs.map
