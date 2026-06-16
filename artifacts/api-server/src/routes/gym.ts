import { Router } from "express";
import { db, gymsTable, membersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/info", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [gym] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1);
    if (!gym) { res.status(404).json({ error: "Gym not found" }); return; }
    const members = await db.select().from(membersTable).where(eq(membersTable.gymId, gymId));
    res.json({
      plan: gym.plan,
      memberLimit: gym.memberLimit,
      memberCount: members.length,
      subscriptionExpiry: gym.subscriptionExpiry,
      status: gym.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gym/info]", msg);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
