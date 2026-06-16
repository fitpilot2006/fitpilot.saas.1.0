import { Router } from "express";
import { db, aiWorkoutPlansTable, membersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// ─── INTERFACES ───────────────────────────────────────────────────────────────

interface Exercise { name: string; sets: number; reps: string; rest: string; notes: string; }
interface DayPlan { day: string; focus: string; type: string; exercises: Exercise[]; }
interface WeekPlan { week: number; theme: string; focus: string; progressionNote: string; schedule: DayPlan[]; }
interface Generated4WeekPlan {
  goal: string; fitnessLevel: string; trainingDays: number; location: string;
  weeks: WeekPlan[];
  warmup: string; cooldown: string; recoveryGuide: string; nutritionTip: string;
  injuryNotes?: string;
  weeklySchedule: DayPlan[];
  trainingNotes: string;
}

// ─── WEEK THEMES & PROTOCOLS ─────────────────────────────────────────────────

const WEEK_THEMES = [
  {
    theme: "Adaptation & Foundation",
    focus: "Master movement patterns and build your base",
    progressionNote: "Focus on perfect form and full range of motion. Record your starting weights — these are your baseline numbers.",
  },
  {
    theme: "Volume Building",
    focus: "Increase total training volume to drive hypertrophy",
    progressionNote: "Add one extra set per compound exercise. Aim for the upper rep range. You should be slightly more fatigued by end of session.",
  },
  {
    theme: "Intensity Phase",
    focus: "Heavier loads, maximum muscle recruitment",
    progressionNote: "Increase load by 5–10% vs Week 1. You will do fewer reps but with more weight — this is the growth stimulus.",
  },
  {
    theme: "Peak Performance",
    focus: "Maximum output — test your new strength baseline",
    progressionNote: "This is your peak week. Push for personal bests on main compound lifts. Log every rep — you'll use these as Week 1 numbers next cycle.",
  },
];

function weekProtocol(goal: string, weekIdx: number, level: string): { sets: number; reps: string; rest: string } {
  const adv = level === "advanced" ? 1 : 0;
  const table: Record<string, { sets: number[]; reps: string[]; rest: string[] }> = {
    weight_loss:     { sets: [3,3,4,4], reps: ["12–15","15–20","10–12","12–15"], rest: ["45 sec","45 sec","30 sec","30 sec"] },
    muscle_gain:     { sets: [3,4,4,5], reps: ["10–12","10–12","8–10","6–8"],   rest: ["60 sec","60 sec","75 sec","90 sec"] },
    strength:        { sets: [4,4,5,5], reps: ["6–8","6–8","4–6","3–5"],        rest: ["2 min","2 min","2.5 min","3 min"] },
    general_fitness: { sets: [3,3,4,4], reps: ["10–12","12–15","10–12","8–12"], rest: ["60 sec","60 sec","60 sec","75 sec"] },
  };
  const t = table[goal] ?? table.general_fitness;
  const w = Math.min(weekIdx, 3);
  return { sets: t.sets[w] + adv, reps: t.reps[w], rest: t.rest[w] };
}

// ─── EXERCISE DATABASE ────────────────────────────────────────────────────────

const GYM_EXERCISES: Record<string, string[][]> = {
  chest: [
    ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Chest Fly"],
    ["Dumbbell Bench Press", "Incline Barbell Press", "Pec Deck Machine"],
    ["Low-Incline Barbell Press", "Weighted Chest Dips", "Cable Crossover"],
    ["Barbell Bench Press (heavy)", "Decline Dumbbell Press", "High-to-Low Cable Fly"],
  ],
  back: [
    ["Pull-Ups", "Barbell Row", "Lat Pulldown"],
    ["Seated Cable Row", "T-Bar Row", "Single-Arm DB Row"],
    ["Chest-Supported Row", "Pendlay Row", "Straight-Arm Pulldown"],
    ["Weighted Pull-Ups", "Heavy Barbell Row", "Face Pulls"],
  ],
  legs: [
    ["Barbell Back Squat", "Leg Press", "Romanian Deadlift", "Leg Curl"],
    ["Bulgarian Split Squat", "Hack Squat", "Sumo Deadlift", "Leg Extension"],
    ["Front Squat", "Leg Press (heavy)", "Nordic Curl", "Walking Lunges"],
    ["Barbell Squat (PR attempt)", "Hack Squat (heavy)", "Romanian Deadlift (heavy)", "Calf Raises"],
  ],
  shoulders: [
    ["Overhead Press", "Lateral Raise", "Rear Delt Fly"],
    ["Arnold Press", "Cable Lateral Raise", "Upright Row"],
    ["Seated DB Press", "Bent-Over Lateral Raise", "Face Pulls"],
    ["Military Press (heavy)", "Lateral Raise Drop Set", "Rear Delt Machine"],
  ],
  triceps: [
    ["Tricep Pushdown", "Overhead Tricep Extension", "Skull Crushers"],
    ["Close-Grip Bench Press", "Cable Kickback", "Tricep Dips"],
    ["Overhead Cable Extension", "Diamond Push-Ups", "Single-Arm Pushdown"],
    ["Weighted Dips", "EZ-Bar Skull Crusher", "Rope Pushdown Drop Set"],
  ],
  biceps: [
    ["Barbell Curl", "Hammer Curl", "Incline DB Curl"],
    ["Preacher Curl", "Cable Curl", "Concentration Curl"],
    ["EZ-Bar Curl", "Reverse Curl", "Cross-Body Hammer Curl"],
    ["Barbell Curl (heavy)", "Cable Rope Hammer Curl", "21s Barbell Curl"],
  ],
  core: [
    ["Plank", "Crunches", "Leg Raises"],
    ["Ab Rollout", "Hanging Knee Raises", "Russian Twists"],
    ["Cable Crunch", "Bicycle Crunches", "Side Plank"],
    ["Weighted Plank", "Hanging Leg Raise", "Dragon Flag Progression"],
  ],
  cardio: [
    ["Treadmill HIIT: 1 min sprint / 1 min walk × 10"],
    ["Rowing Machine: 20 min moderate pace, build each 5 min"],
    ["Stationary Bike Intervals: 30s hard / 30s easy × 12"],
    ["Jump Rope Circuit: 3 × 3 min with 1 min rest"],
  ],
  fullbody: [
    ["Deadlift", "Barbell Back Squat", "Bench Press", "Pull-Ups", "Overhead Press"],
    ["Romanian Deadlift", "Front Squat", "Incline Press", "Pendlay Row", "Push Press"],
    ["Sumo Deadlift", "Goblet Squat", "DB Bench Press", "Lat Pulldown", "Arnold Press"],
    ["Deadlift (PR attempt)", "Squat (PR attempt)", "Push Press", "Weighted Pull-Ups", "Dips"],
  ],
};

const HOME_EXERCISES: Record<string, string[][]> = {
  chest: [
    ["Push-Ups", "Wide Push-Ups", "Diamond Push-Ups"],
    ["Decline Push-Ups", "Archer Push-Ups", "Slow-Tempo Push-Ups (4-0-4)"],
    ["Explosive Clap Push-Ups", "Staggered Push-Ups", "One-Arm Assisted Push-Ups"],
    ["Push-Up Circuit: Wide + Diamond + Regular", "Plyo Push-Ups", "Pseudo Planche Push-Ups"],
  ],
  back: [
    ["Superman Holds", "Bird-Dog", "Reverse Snow Angels"],
    ["Doorframe Pull-Ups", "Bodyweight Row (table)", "Good Mornings"],
    ["Band Row", "Renegade Row", "Resistance Band Pull-Apart"],
    ["Weighted Pull-Ups (backpack)", "Single-Arm DB Row", "Band Face Pulls"],
  ],
  legs: [
    ["Air Squat", "Reverse Lunges", "Glute Bridge", "Calf Raises"],
    ["Bulgarian Split Squat", "Step-Ups", "Single-Leg Glute Bridge", "Wall Sit"],
    ["Jump Squats", "Walking Lunges", "Nordic Curl", "Pistol Squat Progression"],
    ["Weighted Goblet Squat", "Explosive Split Jumps", "Nordic Curl (3×5)", "Pistol Squats"],
  ],
  shoulders: [
    ["Pike Push-Ups", "Band Lateral Raise", "Band Front Raise"],
    ["Handstand Wall Hold", "Band Arnold Press", "Band Rear Delt Fly"],
    ["Decline Pike Push-Ups", "Band Upright Row", "Band Face Pulls"],
    ["Handstand Push-Up Progression", "Band Overhead Press", "Band Pull-Apart Circuit"],
  ],
  triceps: [
    ["Chair Dips", "Diamond Push-Ups", "Close-Grip Push-Ups"],
    ["Bench Dips", "Band Overhead Extension", "Band Kickback"],
    ["Weighted Bench Dips", "Tricep Push-Ups", "Band Pushdown"],
    ["Heavy Bench Dips", "Diamond Drop Set", "Banded Pushdown (slow)"],
  ],
  biceps: [
    ["Band Bicep Curl", "Band Hammer Curl", "Towel Curl"],
    ["Concentration Curl (band)", "Reverse Curl (band)", "Isometric Hold 30 sec"],
    ["DB Curl (if available)", "Band Preacher Curl", "21s (band)"],
    ["DB Curl (heavy)", "Band Hammer Curl Drop Set", "Slow-Tempo Curl 4-1-4"],
  ],
  core: [
    ["Plank", "Crunches", "Leg Raises"],
    ["Mountain Climbers", "Bicycle Crunches", "Reverse Crunch"],
    ["V-Ups", "Side Plank", "Hollow Body Hold"],
    ["Dragon Flag Progression", "L-Sit Hold", "Ab Wheel Rollout"],
  ],
  cardio: [
    ["HIIT: Jumping Jacks + Burpees (30s on / 30s off × 10)"],
    ["Jump Rope Circuit: 3 × 3 min"],
    ["Bodyweight HIIT: Squat Jumps / Mountain Climbers / Burpees, 4 rounds"],
    ["Tabata Sprint: 20s max effort / 10s rest × 8"],
  ],
  fullbody: [
    ["Burpees", "Air Squat", "Push-Ups", "Reverse Lunges", "Plank"],
    ["Squat-to-Press (band)", "Inchworm Walk-Out", "Push-Ups", "Glute Bridge March", "Bear Crawl"],
    ["Jump Squats", "Push-Ups", "Band Row", "Mountain Climbers", "Single-Leg Deadlift"],
    ["Explosive Burpees", "Pistol Squat Progression", "Plyometric Push-Ups", "Band Pull Circuit", "Dragon Flag"],
  ],
};

// ─── SPLITS ───────────────────────────────────────────────────────────────────

const SPLITS: Record<number, { focus: string; groups: string[] }[]> = {
  2: [
    { focus: "Full Body A", groups: ["fullbody","core"] },
    { focus: "Full Body B", groups: ["fullbody","core"] },
  ],
  3: [
    { focus: "Push – Chest, Shoulders & Triceps", groups: ["chest","shoulders","triceps"] },
    { focus: "Pull – Back & Biceps",              groups: ["back","biceps","core"] },
    { focus: "Legs & Core",                       groups: ["legs","core"] },
  ],
  4: [
    { focus: "Upper A – Chest & Back",      groups: ["chest","back","core"] },
    { focus: "Lower A – Quads & Glutes",    groups: ["legs","core"] },
    { focus: "Upper B – Shoulders & Arms",  groups: ["shoulders","triceps","biceps"] },
    { focus: "Lower B – Hamstrings & Calves", groups: ["legs","core"] },
  ],
  5: [
    { focus: "Chest & Triceps",              groups: ["chest","triceps"] },
    { focus: "Back & Biceps",                groups: ["back","biceps"] },
    { focus: "Legs",                         groups: ["legs","core"] },
    { focus: "Shoulders & Core",             groups: ["shoulders","core"] },
    { focus: "Full Body Conditioning",       groups: ["fullbody","cardio"] },
  ],
  6: [
    { focus: "Push A – Chest Focus",         groups: ["chest","shoulders","triceps"] },
    { focus: "Pull A – Back Emphasis",       groups: ["back","biceps"] },
    { focus: "Legs A – Quad Drive",          groups: ["legs","core"] },
    { focus: "Push B – Shoulder Focus",      groups: ["shoulders","chest","triceps"] },
    { focus: "Pull B – Biceps & Core",       groups: ["back","biceps","core"] },
    { focus: "Legs B – Posterior Chain",     groups: ["legs","core"] },
  ],
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── INJURY FILTER ────────────────────────────────────────────────────────────

const INJURY_FILTERS: { keywords: string[]; blocked: string[] }[] = [
  {
    keywords: ["shoulder","rotator","ac joint"],
    blocked: ["overhead press","arnold press","front raise","military press","upright row","behind neck","shoulder press","pike push-up","handstand"],
  },
  {
    keywords: ["knee","patella","meniscus"],
    blocked: ["squat","lunge","leg press","hack squat","step-up","split squat","pistol","jump squat","split jump"],
  },
  {
    keywords: ["lower back","lumbar","disc"],
    blocked: ["deadlift","barbell row","good morning","pendlay","sumo deadlift","nordic curl"],
  },
  {
    keywords: ["wrist","carpal"],
    blocked: ["barbell bench","barbell curl","push-up","skull crusher","clean","snatch"],
  },
  {
    keywords: ["elbow","tennis elbow","golfer"],
    blocked: ["skull crusher","overhead extension","close-grip bench","preacher curl","reverse curl"],
  },
];

function isBlocked(exerciseName: string, injuries: string): boolean {
  const injLower = injuries.toLowerCase();
  const exLower = exerciseName.toLowerCase();
  for (const filter of INJURY_FILTERS) {
    if (filter.keywords.some(k => injLower.includes(k))) {
      if (filter.blocked.some(b => exLower.includes(b))) return true;
    }
  }
  return false;
}

// ─── EXERCISE PICKER ─────────────────────────────────────────────────────────

function pickExercises(
  groups: string[],
  goal: string,
  level: string,
  weekIdx: number,
  location: string,
  injuries: string,
): Exercise[] {
  const proto = weekProtocol(goal, weekIdx, level);
  const pool = location === "gym" ? GYM_EXERCISES : HOME_EXERCISES;
  const exs: Exercise[] = [];

  for (const g of groups) {
    const variants = pool[g];
    if (!variants) continue;
    const weekVariant = variants[weekIdx] ?? variants[0];
    const count = g === "core" ? 2 : g === "cardio" ? 1 : g === "fullbody" ? 5 : 3;

    const allowed = weekVariant.filter(name => !isBlocked(name, injuries));

    for (let i = 0; i < Math.min(count, allowed.length); i++) {
      const name = allowed[i];
      exs.push({
        name,
        sets: g === "cardio" ? 1 : proto.sets,
        reps: g === "cardio" ? "See notes" : (g === "core" ? "12–20" : proto.reps),
        rest: g === "cardio" ? "—" : (g === "core" ? "30 sec" : proto.rest),
        notes: g === "cardio"
          ? name
          : i === 0
            ? "Control the eccentric (lowering) phase — 2–3 seconds down"
            : "Full range of motion; pause briefly at the peak contraction",
      });
    }
  }
  return exs;
}

// ─── TRAINING DAY INDICES ─────────────────────────────────────────────────────

function getTrainingIndices(days: number): number[] {
  if (days <= 3) return Array.from({ length: days }, (_, i) => i * Math.floor(7 / days));
  if (days === 4) return [0, 1, 3, 4];
  if (days === 5) return [0, 1, 2, 3, 5];
  return [0, 1, 2, 3, 4, 5];
}

// ─── WEEK SCHEDULE GENERATOR ──────────────────────────────────────────────────

function buildWeekSchedule(params: {
  fitnessLevel: string; goal: string; trainingDays: number;
  location: string; injuries: string; weekIdx: number;
}): DayPlan[] {
  const { fitnessLevel, goal, trainingDays, location, injuries, weekIdx } = params;
  const days = Math.min(Math.max(trainingDays, 2), 6);
  const split = SPLITS[days] ?? SPLITS[3];
  const trainingIndices = getTrainingIndices(days);
  const schedule: DayPlan[] = [];
  let splitIdx = 0;

  for (let d = 0; d < 7; d++) {
    if (trainingIndices.includes(d)) {
      const s = split[splitIdx % split.length];
      schedule.push({
        day: DAYS[d],
        focus: s.focus,
        type: s.groups.includes("cardio") ? "cardio" : "strength",
        exercises: pickExercises(s.groups, goal, fitnessLevel, weekIdx, location, injuries),
      });
      splitIdx++;
    } else {
      schedule.push({ day: DAYS[d], focus: "Rest & Active Recovery", type: "rest", exercises: [] });
    }
  }
  return schedule;
}

// ─── MAIN GENERATOR ───────────────────────────────────────────────────────────

function generate4WeekPlan(params: {
  age: number; gender: string; weight: string; height: string;
  fitnessLevel: string; goal: string; trainingDays: number;
  location?: string; equipment?: string; injuries?: string;
}): Generated4WeekPlan {
  const { fitnessLevel, goal, trainingDays } = params;
  const location = params.location ?? "gym";
  const injuries = params.injuries ?? "";
  const days = Math.min(Math.max(trainingDays, 2), 6);

  const weeks: WeekPlan[] = WEEK_THEMES.map((theme, weekIdx) => ({
    week: weekIdx + 1,
    theme: theme.theme,
    focus: theme.focus,
    progressionNote: theme.progressionNote,
    schedule: buildWeekSchedule({ fitnessLevel, goal, trainingDays: days, location, injuries, weekIdx }),
  }));

  const notes: Record<string, string> = {
    weight_loss:    "Combine with a caloric deficit of 400–500 kcal/day. Keep rest periods short to maintain elevated heart rate. Add 20 min steady-state cardio on rest days for accelerated fat loss.",
    muscle_gain:    "Eat in a slight caloric surplus (250–400 kcal). Track progressive overload every week — aim to add weight or reps each session. Prioritise 7–9 hours sleep for maximum recovery.",
    strength:       "Focus on heavy compound lifts. Warm up thoroughly with sub-maximal sets. Log all weights and aim to beat personal records by Week 4.",
    general_fitness:"Keep intensity moderate and consistent. Listen to your body. Aim for 7–9 hours of sleep. Consistency over 4 weeks beats any single heroic effort.",
  };

  const tips: Record<string, string> = {
    weight_loss:    "Target 1.8–2.2 g of protein per kg of bodyweight to preserve muscle on the cut. Eat high-volume, low-calorie foods (vegetables, lean protein) to stay satiated.",
    muscle_gain:    "Don't skip carbohydrates — they fuel your workouts and drive muscle recovery. Aim for 4–6 g/kg from quality sources: oats, rice, sweet potato, fruit.",
    strength:       "Creatine monohydrate (3–5 g/day) is the most evidence-backed supplement for strength gains. Take it consistently regardless of training days.",
    general_fitness:"Stay hydrated — drink at least 35 ml per kg of bodyweight daily. Add ~500 ml for every hour of training.",
  };

  const injuryNotes = injuries
    ? `Injury notes: Based on "${injuries}", certain high-risk exercises have been excluded. If any movement causes pain, stop immediately and consult a physiotherapist.`
    : undefined;

  return {
    goal, fitnessLevel, trainingDays: days, location,
    weeks,
    warmup: "5–10 min light cardio (treadmill jog or bike) + dynamic mobility: leg swings × 10, arm circles × 15, hip circles × 10, inchworms × 5, world's greatest stretch × 5 per side.",
    cooldown: "5 min of static stretching: quad stretch 30 sec, hamstring stretch 30 sec, chest opener 30 sec, shoulder cross-body 30 sec, pigeon pose or figure-4 stretch 45 sec per side.",
    recoveryGuide: "Rest days are growth days. Prioritise 7–9 hrs sleep. Light walking, foam rolling, or gentle yoga accelerates recovery without adding fatigue. Avoid training the same muscle group on consecutive days.",
    nutritionTip: tips[goal] ?? tips.general_fitness,
    injuryNotes,
    weeklySchedule: weeks[0].schedule,
    trainingNotes: notes[goal] ?? notes.general_fitness,
  };
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

router.post("/generate", async (req, res) => {
  try {
    const { age, gender, weight, height, fitnessLevel, goal, trainingDays, location, equipment, injuries } = req.body;
    if (!age || !gender || !fitnessLevel || !goal || !trainingDays) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const plan = generate4WeekPlan({
      age: Number(age), gender, weight: String(weight ?? ""), height: String(height ?? ""),
      fitnessLevel, goal, trainingDays: Number(trainingDays),
      location: location ?? "gym", equipment: equipment ?? "full_gym", injuries: injuries ?? "",
    });
    res.json({ plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Generation failed" });
  }
});

router.get("/", async (req, res) => {
  try {
    const plans = await db.select().from(aiWorkoutPlansTable).where(eq(aiWorkoutPlansTable.gymId, req.gymId!));
    res.json(plans.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const { memberId, memberName, age, gender, weight, height, fitnessLevel, goal, trainingDays, plan } = req.body;
    if (!memberId || !plan) { res.status(400).json({ error: "memberId and plan are required" }); return; }
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, Number(memberId)), eq(membersTable.gymId, gymId))).limit(1);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    const [saved] = await db.insert(aiWorkoutPlansTable).values({
      gymId, memberId: Number(memberId), memberName: memberName ?? member.name,
      age: age ? Number(age) : null, gender: gender ?? null,
      weightVal: weight ? String(weight) : null, heightVal: height ? String(height) : null,
      fitnessLevel: fitnessLevel ?? null, goal: goal ?? null,
      trainingDays: trainingDays ? Number(trainingDays) : null, plan,
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.gymId, gymId), eq(membersTable.email, req.userEmail!))).limit(1);
    if (!member) { res.json([]); return; }
    const plans = await db.select().from(aiWorkoutPlansTable)
      .where(and(eq(aiWorkoutPlansTable.gymId, gymId), eq(aiWorkoutPlansTable.memberId, member.id)));
    const reversed = plans.reverse();
    if (reversed.length > 0) {
      const p = reversed[0].plan as Record<string, unknown>;
      const weeks = p?.weeks as unknown[];
      const wk0 = weeks?.[0] as Record<string, unknown> | undefined;
      const sched = wk0?.schedule as unknown[];
      const day0 = sched?.[0] as Record<string, unknown> | undefined;
      const exs = day0?.exercises as unknown[];
      console.log(`[ai-workout/me] ${reversed.length} plans; plan keys=${Object.keys(p ?? {}).join(',')}; has weeks=${!!weeks} (${weeks?.length}); wk0 days=${sched?.length}; day0 exs=${exs?.length}; warmup=${!!(p?.warmup)}`);
    }
    res.json(reversed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/me", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [member] = await db.select().from(membersTable)
      .where(and(eq(membersTable.gymId, gymId), eq(membersTable.email, req.userEmail!))).limit(1);
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }
    const { age, gender, weight, height, fitnessLevel, goal, trainingDays, plan } = req.body;
    if (!plan) { res.status(400).json({ error: "plan is required" }); return; }
    const [saved] = await db.insert(aiWorkoutPlansTable).values({
      gymId, memberId: member.id, memberName: member.name,
      age: age ? Number(age) : null, gender: gender ?? null,
      weightVal: weight ? String(weight) : null, heightVal: height ? String(height) : null,
      fitnessLevel: fitnessLevel ?? null, goal: goal ?? null,
      trainingDays: trainingDays ? Number(trainingDays) : null, plan,
    }).returning();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [plan] = await db.select().from(aiWorkoutPlansTable)
      .where(and(eq(aiWorkoutPlansTable.id, Number(req.params.id)), eq(aiWorkoutPlansTable.gymId, req.gymId!))).limit(1);
    if (!plan) { res.status(404).json({ error: "Not found" }); return; }
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(aiWorkoutPlansTable)
      .where(and(eq(aiWorkoutPlansTable.id, Number(req.params.id)), eq(aiWorkoutPlansTable.gymId, req.gymId!)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
