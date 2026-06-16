import { Router } from "express";
import { db, paymentsTable, membersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { memberId, status } = req.query as { memberId?: string; status?: string };

    let payments = await db.select().from(paymentsTable)
      .where(eq(paymentsTable.gymId, gymId))
      .orderBy(desc(paymentsTable.createdAt));

    if (memberId) payments = payments.filter(p => p.memberId === Number(memberId));
    if (status) payments = payments.filter(p => p.status === status);

    res.json(payments.map(p => ({
      id: p.id, memberId: p.memberId, memberName: p.memberName,
      amount: Number(p.amount), status: p.status, description: p.description,
      dueDate: p.dueDate, paidAt: p.paidAt, createdAt: p.createdAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { memberId, amount, description, dueDate, status } = req.body;

    if (!memberId || amount === undefined || !dueDate) {
      res.status(400).json({ error: "memberId, amount, dueDate required" });
      return;
    }

    const { membersTable: mt } = await import("@workspace/db");
    const [member] = await db.select().from(mt)
      .where(and(eq(mt.id, Number(memberId)), eq(mt.gymId, gymId)))
      .limit(1);

    const memberName = member?.name ?? "Unknown";

    const [payment] = await db.insert(paymentsTable).values({
      gymId, memberId, memberName, amount: String(amount),
      description: description ?? null, dueDate, status: status ?? "pending",
    }).returning();

    res.status(201).json({
      id: payment.id, memberId: payment.memberId, memberName: payment.memberName,
      amount: Number(payment.amount), status: payment.status, description: payment.description,
      dueDate: payment.dueDate, paidAt: payment.paidAt, createdAt: payment.createdAt,
    });
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
    const payments = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.gymId, gymId), eq(paymentsTable.memberId, member.id)))
      .orderBy(desc(paymentsTable.createdAt))
      .limit(50);
    res.json(payments.map(p => ({
      id: p.id, memberId: p.memberId, memberName: p.memberName,
      amount: Number(p.amount), status: p.status, description: p.description,
      dueDate: p.dueDate, paidAt: p.paidAt, createdAt: p.createdAt,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(paymentsTable)
      .where(and(eq(paymentsTable.id, id), eq(paymentsTable.gymId, gymId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }

    const { amount, status, description, dueDate, paidAt } = req.body;
    const updates: Partial<typeof paymentsTable.$inferInsert> = {};
    if (amount !== undefined) updates.amount = String(amount);
    if (status !== undefined) updates.status = status;
    if (description !== undefined) updates.description = description;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (paidAt !== undefined) updates.paidAt = paidAt ? new Date(paidAt) : null;

    const [updated] = await db.update(paymentsTable).set(updates)
      .where(and(eq(paymentsTable.id, id), eq(paymentsTable.gymId, gymId))).returning();
    res.json({
      id: updated.id, memberId: updated.memberId, memberName: updated.memberName,
      amount: Number(updated.amount), status: updated.status, description: updated.description,
      dueDate: updated.dueDate, paidAt: updated.paidAt, createdAt: updated.createdAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
