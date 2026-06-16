import { Router } from "express";
import { db, membersTable, attendanceTable, paymentsTable, workoutPlansTable, gymsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

function toMs(d: Date | string | null | undefined): number {
  if (!d) return 0;
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

router.get("/stats", async (req, res) => {
  try {
    const gymId = req.gymId!;

    const [members, payments, workoutPlans, allAttendance, gymRows] = await Promise.all([
      db.select().from(membersTable).where(eq(membersTable.gymId, gymId)),
      db.select().from(paymentsTable).where(eq(paymentsTable.gymId, gymId)),
      db.select().from(workoutPlansTable).where(eq(workoutPlansTable.gymId, gymId)),
      db.select().from(attendanceTable).where(eq(attendanceTable.gymId, gymId)),
      db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1),
    ]);
    const gym = gymRows[0] ?? null;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 86400000 - 1;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const todayCount = allAttendance.filter(a => {
      const t = toMs(a.checkInAt);
      return t >= startOfDay && t <= endOfDay;
    }).length;

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const totalMembers = members.length;
    const activeMembers = members.filter(m =>
      m.status === "active" && new Date(m.membershipExpiry).getTime() >= todayMidnight
    ).length;
    const expiredMembers = members.filter(m =>
      m.status === "expired" ||
      (m.status === "active" && new Date(m.membershipExpiry).getTime() < todayMidnight)
    ).length;
    const newMembersThisMonth = members.filter(m => toMs(m.joinedAt) >= startOfMonth).length;

    const paidThisMonth = payments.filter(p => {
      const t = toMs(p.createdAt);
      return p.status === "paid" && t >= startOfMonth;
    });
    const monthlyRevenue = paidThisMonth.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingPayments = payments
      .filter(p => p.status !== "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const attendanceRate = totalMembers > 0
      ? Math.round((todayCount / totalMembers) * 100)
      : 0;

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
      attendanceRate,
    });
  } catch (err: any) {
    console.error("[dashboard/stats]", err?.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/expiring-memberships", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const members = await db.select().from(membersTable).where(eq(membersTable.gymId, gymId));
    const now = new Date();
    const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7);

    const expiring = members.filter(m => {
      const exp = new Date(m.membershipExpiry);
      return m.status === "active" && exp >= now && exp <= in7Days;
    });

    res.json(expiring.map(m => ({
      id: m.id, name: m.name, email: m.email, phone: m.phone,
      membershipType: m.membershipType, membershipExpiry: m.membershipExpiry,
      status: m.status,
    })));
  } catch (err) {
    console.error("[dashboard/expiring]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recent-checkins", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const records = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.gymId, gymId))
      .orderBy(desc(attendanceTable.checkInAt))
      .limit(8);
    res.json(records);
  } catch (err) {
    console.error("[dashboard/recent-checkins]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/revenue-chart", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.gymId, gymId));
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const revenue = payments
        .filter(p => {
          const t = toMs(p.createdAt);
          return p.status === "paid" && t >= start && t <= end;
        })
        .reduce((sum, p) => sum + Number(p.amount), 0);
      result.push({ month, revenue });
    }
    res.json(result);
  } catch (err) {
    console.error("[dashboard/revenue-chart]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/attendance-chart", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const records = await db.select().from(attendanceTable).where(eq(attendanceTable.gymId, gymId));
    const now = new Date();
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 86400000 - 1;
      const date = d.toISOString().split("T")[0];
      const count = records.filter(r => {
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

export default router;
