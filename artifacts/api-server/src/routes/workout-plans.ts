import { Router } from "express";
import { db, workoutPlansTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

function serialize(p: typeof workoutPlansTable.$inferSelect) {
  return {
    id: p.id, name: p.name, description: p.description,
    difficulty: p.difficulty, durationWeeks: p.durationWeeks,
    exercises: p.exercises, createdAt: p.createdAt,
  };
}

router.get("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const plans = await db.select().from(workoutPlansTable)
      .where(eq(workoutPlansTable.gymId, gymId))
      .orderBy(desc(workoutPlansTable.createdAt));
    res.json(plans.map(serialize));
  } catch (err) {
    console.error("[workout-plans/get]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { name, description, difficulty, durationWeeks, exercises } = req.body;
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const [plan] = await db.insert(workoutPlansTable).values({
      gymId, name,
      description: description ?? null,
      difficulty: difficulty ?? "beginner",
      durationWeeks: durationWeeks ?? 4,
      exercises: exercises ?? [],
    }).returning();
    res.status(201).json(serialize(plan));
  } catch (err) {
    console.error("[workout-plans/post]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [plan] = await db.select().from(workoutPlansTable)
      .where(and(eq(workoutPlansTable.id, id), eq(workoutPlansTable.gymId, gymId)))
      .limit(1);
    if (!plan) { res.status(404).json({ error: "Workout plan not found" }); return; }
    res.json(serialize(plan));
  } catch (err) {
    console.error("[workout-plans/get-id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(workoutPlansTable)
      .where(and(eq(workoutPlansTable.id, id), eq(workoutPlansTable.gymId, gymId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Workout plan not found" }); return; }

    const { name, description, difficulty, durationWeeks, exercises } = req.body;
    const updates: Partial<typeof workoutPlansTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (durationWeeks !== undefined) updates.durationWeeks = durationWeeks;
    if (exercises !== undefined) updates.exercises = exercises;

    const [updated] = await db.update(workoutPlansTable).set(updates)
      .where(and(eq(workoutPlansTable.id, id), eq(workoutPlansTable.gymId, gymId))).returning();
    res.json(serialize(updated));
  } catch (err) {
    console.error("[workout-plans/patch]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(workoutPlansTable)
      .where(and(eq(workoutPlansTable.id, id), eq(workoutPlansTable.gymId, gymId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Workout plan not found" }); return; }
    await db.delete(workoutPlansTable).where(and(eq(workoutPlansTable.id, id), eq(workoutPlansTable.gymId, gymId)));
    res.status(204).send();
  } catch (err) {
    console.error("[workout-plans/delete]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
