import { Router } from "express";
import { db, attendanceTable, membersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { memberId, date } = req.query as { memberId?: string; date?: string };

    let records = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.gymId, gymId))
      .orderBy(desc(attendanceTable.checkInAt));

    if (memberId) records = records.filter(r => r.memberId === Number(memberId));
    if (date) {
      const d = new Date(date);
      const start = new Date(d); start.setHours(0,0,0,0);
      const end = new Date(d); end.setHours(23,59,59,999);
      records = records.filter(r => r.checkInAt >= start && r.checkInAt <= end);
    }

    res.json(records.map(r => ({
      id: r.id, memberId: r.memberId, memberName: r.memberName,
      checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, notes: r.notes,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/today", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0);
    const end = new Date(now); end.setHours(23,59,59,999);

    const records = await db.select().from(attendanceTable).where(eq(attendanceTable.gymId, gymId));
    const todayRecords = records.filter(r => r.checkInAt >= start && r.checkInAt <= end);

    res.json(todayRecords.map(r => ({
      id: r.id, memberId: r.memberId, memberName: r.memberName,
      checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, notes: r.notes,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const email = req.userEmail!;
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.gymId, gymId), eq(membersTable.email, email)))
      .limit(1);
    if (!member) { res.json([]); return; }
    const records = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.gymId, gymId), eq(attendanceTable.memberId, member.id)))
      .orderBy(desc(attendanceTable.checkInAt))
      .limit(100);
    res.json(records.map(r => ({
      id: r.id, memberId: r.memberId, memberName: r.memberName,
      checkInAt: r.checkInAt, checkOutAt: r.checkOutAt, notes: r.notes,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { memberId, notes } = req.body as { memberId: number; notes?: string };

    if (!memberId) {
      res.status(400).json({ error: "memberId required" });
      return;
    }

    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, memberId), eq(membersTable.gymId, gymId)))
      .limit(1);
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const [record] = await db.insert(attendanceTable).values({
      gymId, memberId, memberName: member.name, notes: notes ?? null,
    }).returning();

    res.status(201).json({
      id: record.id, memberId: record.memberId, memberName: record.memberName,
      checkInAt: record.checkInAt, checkOutAt: record.checkOutAt, notes: record.notes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
