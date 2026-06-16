import { Router } from "express";
import { db, membersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

function genMemberCode(): string {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `MEM-${digits}`;
}

function effectiveStatus(m: typeof membersTable.$inferSelect): string {
  if (m.status === "active") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(m.membershipExpiry) < today) return "expired";
  }
  return m.status;
}

function serializeMember(m: typeof membersTable.$inferSelect) {
  return {
    id: m.id, name: m.name, email: m.email, phone: m.phone,
    membershipType: m.membershipType, membershipExpiry: m.membershipExpiry,
    status: effectiveStatus(m),
    joinedAt: m.joinedAt, workoutPlanId: m.workoutPlanId,
    notes: m.notes, photoUrl: m.photoUrl, qrToken: m.qrToken,
    memberCode: m.memberCode,
    emergencyContact: m.emergencyContact, address: m.address, dateOfBirth: m.dateOfBirth,
  };
}

router.get("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { status, search } = req.query as { status?: string; search?: string };

    let members = await db.select().from(membersTable)
      .where(eq(membersTable.gymId, gymId))
      .orderBy(desc(membersTable.joinedAt));

    if (status) members = members.filter(m => effectiveStatus(m) === status);
    if (search) {
      const s = search.toLowerCase();
      members = members.filter(m =>
        m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s) ||
        m.phone.includes(s) || (m.memberCode ?? "").toLowerCase().includes(s)
      );
    }

    res.json(members.map(serializeMember));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { name, email, phone, membershipType, membershipExpiry, workoutPlanId, notes, emergencyContact, address } = req.body;

    if (!name || !email || !phone || !membershipType || !membershipExpiry) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const { gymsTable } = await import("@workspace/db");
    const { eq: eqFn } = await import("drizzle-orm");
    const [gym] = await db.select().from(gymsTable).where(eqFn(gymsTable.id, gymId)).limit(1);
    if (gym?.memberLimit !== null && gym?.memberLimit !== undefined) {
      const existing = await db.select().from(membersTable).where(eq(membersTable.gymId, gymId));
      if (existing.length >= gym.memberLimit) {
        res.status(403).json({ error: `Member limit reached (${gym.memberLimit}). Upgrade your plan to add more members.` });
        return;
      }
    }

    const qrToken = `GF-${gymId}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const memberCode = genMemberCode();

    const [member] = await db.insert(membersTable).values({
      gymId, name, email, phone, membershipType, membershipExpiry,
      workoutPlanId: workoutPlanId ?? null, notes: notes ?? null,
      emergencyContact: emergencyContact ?? null, address: address ?? null,
      qrToken, memberCode,
    }).returning();

    res.status(201).json(serializeMember(member));
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
    if (!member) { res.status(404).json({ error: "Member profile not found" }); return; }
    res.json(serializeMember(member));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, id), eq(membersTable.gymId, gymId)))
      .limit(1);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    res.json(serializeMember(member));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, id), eq(membersTable.gymId, gymId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Member not found" }); return; }

    const allowed = ["name", "email", "phone", "membershipType", "membershipExpiry", "status", "workoutPlanId", "notes", "photoUrl", "emergencyContact", "address", "dateOfBirth"] as const;
    const updates: Partial<typeof membersTable.$inferInsert> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) (updates as any)[key] = req.body[key];
    }

    const [updated] = await db.update(membersTable).set(updates)
      .where(and(eq(membersTable.id, id), eq(membersTable.gymId, gymId))).returning();
    res.json(serializeMember(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, id), eq(membersTable.gymId, gymId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Member not found" }); return; }
    await db.delete(membersTable).where(and(eq(membersTable.id, id), eq(membersTable.gymId, gymId)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
