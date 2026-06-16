import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  db, platformAdminsTable, gymsTable, accessCodesTable,
  gymSubscriptionsTable, membersTable, gymApplicationsTable,
  gymUsersTable, paymentsTable, attendanceTable, workoutPlansTable,
  brandingTable, notificationSettingsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requirePlatformAdmin } from "../middlewares/auth.js";
import { signGymToken, signPlatformAdminToken } from "../lib/jwt.js";

const router = Router();

router.post("/auth/bootstrap", async (req, res) => {
  try {
    const [existing] = await db.select().from(platformAdminsTable).limit(1);
    if (existing) { res.status(409).json({ error: "Platform admin already exists" }); return; }
    const { email, password, name } = req.body as { email: string; password: string; name?: string };
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const [admin] = await db.insert(platformAdminsTable).values({ email, passwordHash, name: name ?? "Platform Admin" }).returning();
    const token = signPlatformAdminToken({ adminId: admin.id, email: admin.email, role: "platform_admin", gymId: 0 });
    res.status(201).json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bootstrap]", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const [admin] = await db.select().from(platformAdminsTable).where(eq(platformAdminsTable.email, email)).limit(1);
    if (!admin) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = signPlatformAdminToken({ adminId: admin.id, email: admin.email, role: "platform_admin", gymId: 0 });
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[login]", msg);
    res.status(500).json({ error: msg });
  }
});

router.use(requirePlatformAdmin);

router.get("/gyms", async (req, res) => {
  try {
    const gyms = await db.select().from(gymsTable).orderBy(desc(gymsTable.createdAt));
    const result = await Promise.all(gyms.map(async g => {
      const members = await db.select().from(membersTable).where(eq(membersTable.gymId, g.id));
      const [activeSub] = await db.select().from(gymSubscriptionsTable)
        .where(eq(gymSubscriptionsTable.gymId, g.id))
        .orderBy(desc(gymSubscriptionsTable.createdAt))
        .limit(1);
      return {
        id: g.id, name: g.name, slug: g.slug, plan: g.plan, status: g.status,
        memberJoinCode: g.memberJoinCode, memberLimit: g.memberLimit,
        subscriptionExpiry: g.subscriptionExpiry, createdAt: g.createdAt,
        memberCount: members.length,
        activeMembers: members.filter(m => m.status === "active").length,
        latestSub: activeSub ? { plan: activeSub.plan, endDate: activeSub.endDate, status: activeSub.status } : null,
      };
    }));
    res.json(result);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[gyms]", msg); res.status(500).json({ error: msg }); }
});

router.patch("/gyms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, plan, name, memberLimit, subscriptionExpiry } = req.body;
    const updates: Partial<typeof gymsTable.$inferInsert> = {};
    if (status !== undefined) updates.status = status;
    if (plan !== undefined) updates.plan = plan;
    if (name !== undefined) updates.name = name;
    if (memberLimit !== undefined) updates.memberLimit = memberLimit === "" ? null : Number(memberLimit);
    if (subscriptionExpiry !== undefined) updates.subscriptionExpiry = subscriptionExpiry || null;
    const [updated] = await db.update(gymsTable).set(updates).where(eq(gymsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Gym not found" }); return; }
    res.json(updated);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[gyms patch]", msg); res.status(500).json({ error: msg }); }
});

router.get("/access-codes", async (req, res) => {
  try {
    const codes = await db.select().from(accessCodesTable).orderBy(desc(accessCodesTable.createdAt));
    res.json(codes);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[access-codes]", msg); res.status(500).json({ error: msg }); }
});

router.post("/access-codes", async (req, res) => {
  try {
    const { label, plan, trialDays } = req.body as { label?: string; plan?: string; trialDays?: number };
    function generateCode(): string {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const part = () => { let s = ""; for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]; return s; };
      return `${part()}-${part()}`;
    }
    const code = generateCode();
    const validPlans = ["basic", "pro", "enterprise"];
    const codePlan = plan && validPlans.includes(plan) ? plan : "basic";
    const [created] = await db.insert(accessCodesTable).values({
      code, label: label ?? null, plan: codePlan,
      trialDays: trialDays ? Number(trialDays) : 30,
    }).returning();
    res.status(201).json(created);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[access-codes post]", msg); res.status(500).json({ error: msg }); }
});

router.delete("/access-codes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(accessCodesTable).where(eq(accessCodesTable.id, id));
    res.status(204).send();
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[access-codes delete]", msg); res.status(500).json({ error: msg }); }
});

router.get("/subscriptions", async (req, res) => {
  try {
    const subs = await db.select().from(gymSubscriptionsTable).orderBy(desc(gymSubscriptionsTable.createdAt));
    const withGym = await Promise.all(subs.map(async s => {
      const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, s.gymId)).limit(1);
      return { ...s, gymName: gym?.name ?? "Unknown" };
    }));
    res.json(withGym);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[subscriptions]", msg); res.status(500).json({ error: msg }); }
});

router.post("/subscriptions", async (req, res) => {
  try {
    const { gymId, plan, startDate, endDate, notes } = req.body;
    if (!gymId || !plan || !startDate || !endDate) {
      res.status(400).json({ error: "gymId, plan, startDate, endDate required" });
      return;
    }
    const [sub] = await db.insert(gymSubscriptionsTable).values({
      gymId: Number(gymId), plan, startDate, endDate, notes: notes ?? null,
    }).returning();
    await db.update(gymsTable).set({ subscriptionExpiry: endDate, plan }).where(eq(gymsTable.id, Number(gymId)));
    res.status(201).json(sub);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[subscriptions post]", msg); res.status(500).json({ error: msg }); }
});

router.get("/stats", async (req, res) => {
  try {
    const [gyms, codes, allMembers, applications] = await Promise.all([
      db.select().from(gymsTable),
      db.select().from(accessCodesTable),
      db.select().from(membersTable),
      db.select().from(gymApplicationsTable),
    ]);
    const totalGyms = gyms.length;
    const activeGyms = gyms.filter(g => g.status === "active").length;
    const suspendedGyms = gyms.filter(g => g.status === "suspended").length;
    const unusedCodes = codes.filter(c => !c.used && c.active).length;
    const totalMembers = allMembers.length;
    const activeMembers = allMembers.filter(m => m.status === "active").length;
    const pendingApplications = applications.filter(a => a.status === "pending").length;
    res.json({ totalGyms, activeGyms, suspendedGyms, unusedCodes, totalMembers, activeMembers, pendingApplications });
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[stats]", msg); res.status(500).json({ error: msg }); }
});

router.get("/applications", async (req, res) => {
  try {
    const apps = await db.select().from(gymApplicationsTable).orderBy(desc(gymApplicationsTable.createdAt));
    res.json(apps);
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[applications get]", msg); res.status(500).json({ error: msg }); }
});

router.patch("/applications/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(gymApplicationsTable).where(eq(gymApplicationsTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Application not found" }); return; }

    const { action, assignedExpiry, assignedMemberLimit, rejectionReason, planRequest } = req.body;

    if (action === "approve") {
      function generateCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const part = () => { let s = ""; for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]; return s; };
        return `${part()}-${part()}`;
      }
      const code = generateCode();
      await db.insert(accessCodesTable).values({
        code,
        label: `${existing.gymName} — ${existing.ownerName}`,
      });
      const [updated] = await db.update(gymApplicationsTable).set({
        status: "approved",
        assignedAccessCode: code,
        assignedExpiry: assignedExpiry ?? null,
        assignedMemberLimit: assignedMemberLimit ? Number(assignedMemberLimit) : null,
      }).where(eq(gymApplicationsTable.id, id)).returning();
      res.json(updated);
    } else if (action === "reject") {
      const [updated] = await db.update(gymApplicationsTable).set({
        status: "rejected",
        rejectionReason: rejectionReason ?? null,
      }).where(eq(gymApplicationsTable.id, id)).returning();
      res.json(updated);
    } else {
      const updates: Partial<typeof gymApplicationsTable.$inferInsert> = {};
      if (assignedExpiry !== undefined) updates.assignedExpiry = assignedExpiry;
      if (assignedMemberLimit !== undefined) updates.assignedMemberLimit = Number(assignedMemberLimit);
      if (planRequest !== undefined) updates.planRequest = planRequest;
      const [updated] = await db.update(gymApplicationsTable).set(updates).where(eq(gymApplicationsTable.id, id)).returning();
      res.json(updated);
    }
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[applications patch]", msg); res.status(500).json({ error: msg }); }
});

router.post("/impersonate/:gymId", async (req, res) => {
  try {
    const gymId = Number(req.params.gymId);
    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1);
    if (!gym) { res.status(404).json({ error: "Gym not found" }); return; }
    const [owner] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.gymId, gymId)).limit(1);
    if (!owner) { res.status(404).json({ error: "No users found for this gym" }); return; }
    const token = signGymToken({ userId: owner.id, gymId: owner.gymId, email: owner.email, role: owner.role });
    res.json({
      token,
      user: { id: owner.id, name: owner.name ?? owner.email, email: owner.email, role: owner.role, gymId: owner.gymId },
      gymName: gym.name,
    });
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[impersonate]", msg); res.status(500).json({ error: msg }); }
});

router.delete("/gyms/:id", async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1);
    if (!gym) { res.status(404).json({ error: "Gym not found" }); return; }

    await db.delete(attendanceTable).where(eq(attendanceTable.gymId, gymId));
    await db.delete(paymentsTable).where(eq(paymentsTable.gymId, gymId));
    await db.delete(workoutPlansTable).where(eq(workoutPlansTable.gymId, gymId));
    await db.delete(membersTable).where(eq(membersTable.gymId, gymId));
    await db.delete(gymSubscriptionsTable).where(eq(gymSubscriptionsTable.gymId, gymId));
    await db.delete(gymUsersTable).where(eq(gymUsersTable.gymId, gymId));
    await db.delete(brandingTable).where(eq(brandingTable.gymId, gymId));
    await db.delete(notificationSettingsTable).where(eq(notificationSettingsTable.gymId, gymId));
    await db.delete(gymsTable).where(eq(gymsTable.id, gymId));
    res.json({ success: true, deletedGymId: gymId, gymName: gym.name });
  } catch (err) { const msg = err instanceof Error ? err.message : String(err); console.error("[delete gym]", msg); res.status(500).json({ error: msg }); }
});

router.patch("/gyms/:id/credentials", async (req, res) => {
  try {
    const gymId = Number(req.params.id);
    const { email, password } = req.body as { email?: string; password?: string };

    const newEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;
    const newPassword = typeof password === "string" ? password.trim() : undefined;

    if (!newEmail && !newPassword) {
      res.status(400).json({ error: "Provide at least an email or password to update" });
      return;
    }

    const [owner] = await db.select().from(gymUsersTable)
      .where(and(eq(gymUsersTable.gymId, gymId), eq(gymUsersTable.role, "owner")))
      .limit(1);
    if (!owner) {
      res.status(404).json({ error: "No owner account found for this gym" });
      return;
    }

    if (newEmail && newEmail !== owner.email) {
      const [conflict] = await db.select().from(gymUsersTable).where(eq(gymUsersTable.email, newEmail)).limit(1);
      if (conflict) {
        res.status(409).json({ error: "That email is already in use by another account" });
        return;
      }
    }

    const updates: Partial<typeof gymUsersTable.$inferInsert> = {};
    if (newEmail) updates.email = newEmail;
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const [updated] = await db.update(gymUsersTable)
      .set(updates)
      .where(eq(gymUsersTable.id, owner.id))
      .returning();

    res.json({ id: updated.id, email: updated.email, role: updated.role });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[credentials]", msg);
    res.status(500).json({ error: msg });
  }
});

router.get("/backup/health", async (_req, res) => {
  try {
    const [gyms, members, payments, attendance, subscriptions, codes, users, applications, dbInfo] = await Promise.all([
      db.select().from(gymsTable),
      db.select().from(membersTable),
      db.select().from(paymentsTable),
      db.select().from(attendanceTable),
      db.select().from(gymSubscriptionsTable),
      db.select().from(accessCodesTable),
      db.select().from(gymUsersTable),
      db.select().from(gymApplicationsTable),
      db.execute<{ current_database: string; pg_version: string }>(
        "SELECT current_database(), split_part(version(), ' ', 2) AS pg_version"
      ),
    ]);
    const dbRow = (dbInfo as any).rows?.[0] ?? {};
    res.json({
      status: "healthy",
      checkedAt: new Date().toISOString(),
      database: {
        provider: "Replit PostgreSQL",
        name: dbRow.current_database ?? "gymflow",
        version: dbRow.pg_version ?? "",
        connected: true,
      },
      tables: {
        gyms: gyms.length,
        members: members.length,
        payments: payments.length,
        attendance: attendance.length,
        gym_subscriptions: subscriptions.length,
        access_codes: codes.length,
        gym_users: users.length,
        gym_applications: applications.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup/health]", msg);
    res.status(500).json({ status: "error", error: msg });
  }
});

router.get("/backup/export", async (_req, res) => {
  try {
    const [gyms, members, payments, attendance, subscriptions, codes] = await Promise.all([
      db.select().from(gymsTable),
      db.select().from(membersTable),
      db.select().from(paymentsTable),
      db.select().from(attendanceTable),
      db.select().from(gymSubscriptionsTable),
      db.select().from(accessCodesTable),
    ]);
    const date = new Date().toISOString().split("T")[0];
    const backup = { exportedAt: new Date().toISOString(), version: "2.0", gyms, members, payments, attendance, gym_subscriptions: subscriptions, access_codes: codes };
    res.setHeader("Content-Disposition", `attachment; filename="gymflow-backup-${date}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backup);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup/export]", msg);
    res.status(500).json({ error: msg });
  }
});

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

router.get("/backup/export/:table", async (req, res) => {
  const { table } = req.params;
  const format = (req.query.format as string) ?? "csv";
  try {
    let data: Record<string, unknown>[] = [];
    switch (table) {
      case "gyms":          data = (await db.select().from(gymsTable)) as unknown as Record<string, unknown>[]; break;
      case "members":       data = (await db.select().from(membersTable)) as unknown as Record<string, unknown>[]; break;
      case "payments":      data = (await db.select().from(paymentsTable)) as unknown as Record<string, unknown>[]; break;
      case "attendance":    data = (await db.select().from(attendanceTable)) as unknown as Record<string, unknown>[]; break;
      case "subscriptions": data = (await db.select().from(gymSubscriptionsTable)) as unknown as Record<string, unknown>[]; break;
      case "access_codes":  data = (await db.select().from(accessCodesTable)) as unknown as Record<string, unknown>[]; break;
      default: res.status(404).json({ error: "Unknown table" }); return;
    }
    const date = new Date().toISOString().split("T")[0];
    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="gymflow-${table}-${date}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.json({ exportedAt: new Date().toISOString(), table, count: data.length, data });
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

router.post("/backup/import", async (req, res) => {
  const summary: Record<string, { inserted: number; skipped: number; errors: string[] }> = {};

  function track(t: string) {
    if (!summary[t]) summary[t] = { inserted: 0, skipped: 0, errors: [] };
    return summary[t];
  }

  try {
    const data = req.body as {
      gyms?: Record<string, unknown>[];
      members?: Record<string, unknown>[];
      payments?: Record<string, unknown>[];
      attendance?: Record<string, unknown>[];
      gym_subscriptions?: Record<string, unknown>[];
      access_codes?: Record<string, unknown>[];
    };

    for (const row of data.access_codes ?? []) {
      const t = track("access_codes");
      try {
        const result = await db.insert(accessCodesTable).values({
          code: String(row.code),
          label: row.label ? String(row.label) : null,
          active: Boolean(row.active ?? true),
          used: Boolean(row.used ?? false),
          usedAt: row.used_at ? new Date(String(row.used_at)) : null,
          usedByGymId: row.used_by_gym_id ? Number(row.used_by_gym_id) : null,
        }).onConflictDoNothing().returning();
        if (result.length) t.inserted++; else t.skipped++;
      } catch (e) { t.errors.push(String((e as Error).message)); }
    }

    for (const row of data.gyms ?? []) {
      const t = track("gyms");
      try {
        const slug = String(row.slug ?? "").trim() || String(row.name ?? "gym").toLowerCase().replace(/[^a-z0-9]/g, "-");
        const [existing] = await db.select().from(gymsTable).where(eq(gymsTable.slug, slug)).limit(1);
        if (existing) { t.skipped++; continue; }
        await db.insert(gymsTable).values({
          name: String(row.name ?? "Imported Gym"),
          slug,
          plan: String(row.plan ?? "starter"),
          status: String(row.status ?? "active"),
          memberJoinCode: row.member_join_code ? String(row.member_join_code) : null,
          memberLimit: row.member_limit ? Number(row.member_limit) : null,
          subscriptionExpiry: row.subscription_expiry ? String(row.subscription_expiry) : null,
        });
        t.inserted++;
      } catch (e) { t.errors.push(String((e as Error).message)); }
    }

    for (const row of data.members ?? []) {
      const t = track("members");
      try {
        const gymId = Number(row.gym_id ?? row.gymId ?? 0);
        if (!gymId) { t.skipped++; continue; }
        await db.insert(membersTable).values({
          gymId,
          name: String(row.name ?? ""),
          email: String(row.email ?? ""),
          phone: String(row.phone ?? ""),
          membershipType: String(row.membership_type ?? row.membershipType ?? "basic"),
          membershipExpiry: String(row.membership_expiry ?? row.membershipExpiry ?? new Date().toISOString().split("T")[0]),
          status: String(row.status ?? "active"),
          notes: row.notes ? String(row.notes) : null,
        });
        t.inserted++;
      } catch (e) { t.errors.push(String((e as Error).message)); }
    }

    for (const row of data.payments ?? []) {
      const t = track("payments");
      try {
        await db.insert(paymentsTable).values({
          gymId: Number(row.gym_id ?? row.gymId),
          memberId: Number(row.member_id ?? row.memberId),
          memberName: String(row.member_name ?? row.memberName ?? ""),
          amount: String(row.amount ?? "0"),
          status: String(row.status ?? "pending"),
          description: row.description ? String(row.description) : null,
          dueDate: String(row.due_date ?? row.dueDate ?? new Date().toISOString().split("T")[0]),
        });
        t.inserted++;
      } catch (e) { t.errors.push(String((e as Error).message)); }
    }

    for (const row of data.attendance ?? []) {
      const t = track("attendance");
      try {
        await db.insert(attendanceTable).values({
          gymId: Number(row.gym_id ?? row.gymId),
          memberId: Number(row.member_id ?? row.memberId),
          memberName: String(row.member_name ?? row.memberName ?? ""),
          checkInAt: row.check_in_at ? new Date(String(row.check_in_at)) : new Date(),
          notes: row.notes ? String(row.notes) : null,
        });
        t.inserted++;
      } catch (e) { t.errors.push(String((e as Error).message)); }
    }

    for (const row of data.gym_subscriptions ?? []) {
      const t = track("gym_subscriptions");
      try {
        await db.insert(gymSubscriptionsTable).values({
          gymId: Number(row.gym_id ?? row.gymId),
          plan: String(row.plan ?? "starter"),
          startDate: String(row.start_date ?? row.startDate ?? ""),
          endDate: String(row.end_date ?? row.endDate ?? ""),
          status: String(row.status ?? "active"),
          notes: row.notes ? String(row.notes) : null,
        });
        t.inserted++;
      } catch (e) { t.errors.push(String((e as Error).message)); }
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

export default router;
