import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain, Dumbbell, ChevronDown, ChevronUp, Trash2, Save,
  Loader2, Zap, Clock, RotateCcw, User, Calendar,
  Target, TrendingUp, AlertCircle, CheckCircle2, Info,
  MapPin, Package, Activity, ChevronRight, Lock, ArrowRight,
} from "lucide-react";
import { api } from "../lib/api.js";

interface GymInfo { plan: string; memberLimit: number | null; memberCount: number; }

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Member { id: number; name: string; email: string; status: string; }

interface WorkoutExercise { name: string; sets: number; reps: string; rest: string; notes: string; }
interface WorkoutDay { day: string; focus: string; type: string; exercises: WorkoutExercise[]; }
interface WeekPlan { week: number; theme: string; focus: string; progressionNote: string; schedule: WorkoutDay[]; }
interface GeneratedWorkoutPlan {
  goal: string; fitnessLevel: string; trainingDays: number; location?: string;
  weeks?: WeekPlan[];
  weeklySchedule?: WorkoutDay[];
  warmup: string; cooldown: string;
  recoveryGuide?: string; trainingNotes?: string; nutritionTip: string;
  injuryNotes?: string;
}
interface SavedWorkoutPlan {
  id: number; memberId: number; memberName: string | null;
  age: number | null; gender: string | null; fitnessLevel: string | null;
  goal: string | null; trainingDays: number | null;
  plan: GeneratedWorkoutPlan; createdAt: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GOALS = [
  { value: "weight_loss",     label: "Weight Loss",     color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  { value: "muscle_gain",     label: "Muscle Gain",     color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "strength",        label: "Strength",         color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
  { value: "general_fitness", label: "General Fitness",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

const FITNESS_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "0–6 months" },
  { value: "intermediate", label: "Intermediate", desc: "6 mo–2 yrs" },
  { value: "advanced",     label: "Advanced",     desc: "2+ years" },
];

const LOCATIONS = [
  { value: "gym",     label: "Gym",     desc: "Full equipment" },
  { value: "home",    label: "Home",    desc: "Minimal gear" },
  { value: "outdoor", label: "Outdoor", desc: "Bodyweight / park" },
];

const EQUIPMENT = [
  { value: "full_gym",        label: "Full Gym",        desc: "Barbells, cables, machines" },
  { value: "dumbbells_only",  label: "Dumbbells Only",  desc: "Dumbbells + bench" },
  { value: "bodyweight_only", label: "Bodyweight Only", desc: "No equipment" },
];

const WEEK_COLORS = [
  "border-[var(--gym-primary)]/40 bg-[var(--gym-primary)]/5",
  "border-blue-500/40 bg-blue-500/5",
  "border-violet-500/40 bg-violet-500/5",
  "border-amber-500/40 bg-amber-500/5",
];
const WEEK_BADGE = [
  "bg-[var(--gym-primary)]/20 text-[var(--gym-primary)]",
  "bg-blue-500/20 text-blue-400",
  "bg-violet-500/20 text-violet-400",
  "bg-amber-500/20 text-amber-400",
];

const DAY_COLORS: Record<string, string> = {
  strength: "border-[var(--gym-primary)]/40 bg-[var(--gym-primary)]/5",
  cardio:   "border-orange-500/40 bg-orange-500/5",
  rest:     "border-white/10 bg-white/3",
};
const DAY_BADGE: Record<string, string> = {
  strength: "bg-[var(--gym-primary)]/20 text-[var(--gym-primary)]",
  cardio:   "bg-orange-500/20 text-orange-400",
  rest:     "bg-white/10 text-white/30",
};

const defaultForm = {
  memberId: "", age: "", gender: "male", weight: "", height: "",
  fitnessLevel: "beginner", goal: "general_fitness", trainingDays: "3",
  location: "gym", equipment: "full_gym", injuries: "",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function goalLabel(g: string) { return GOALS.find(x => x.value === g)?.label ?? g; }
function goalColor(g: string) { return GOALS.find(x => x.value === g)?.color ?? "text-white/60"; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── WEEK SCHEDULE DISPLAY ────────────────────────────────────────────────────

function WeekSchedule({ schedule, initialExpanded = null }: { schedule: WorkoutDay[]; initialExpanded?: number | null }) {
  const [expandedDay, setExpandedDay] = useState<number | null>(initialExpanded);
  return (
    <div className="space-y-2">
      {schedule.map((day, i) => (
        <div key={day.day}
          className={`rounded-xl border transition-all ${DAY_COLORS[day.type] ?? DAY_COLORS.rest}`}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setExpandedDay(expandedDay === i ? null : i)}
            disabled={day.type === "rest"}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white/40 w-10 flex-shrink-0">{day.day.slice(0, 3)}</span>
              <div>
                <p className="text-sm font-semibold text-white">{day.focus}</p>
                {day.type !== "rest" && (
                  <p className="text-xs text-white/40 mt-0.5">{day.exercises.length} exercises</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${DAY_BADGE[day.type] ?? DAY_BADGE.rest}`}>
                {day.type}
              </span>
              {day.type !== "rest" && (
                expandedDay === i
                  ? <ChevronUp className="w-4 h-4 text-white/30" />
                  : <ChevronDown className="w-4 h-4 text-white/30" />
              )}
            </div>
          </button>

          {expandedDay === i && day.type !== "rest" && (
            <div className="px-4 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/8">
                      <th className="text-left py-2 pr-4 font-medium">Exercise</th>
                      <th className="text-center py-2 px-3 font-medium">Sets</th>
                      <th className="text-center py-2 px-3 font-medium">Reps</th>
                      <th className="text-center py-2 px-3 font-medium">Rest</th>
                      <th className="text-left py-2 pl-3 font-medium hidden sm:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {day.exercises.map((ex, j) => (
                      <tr key={j} className="hover:bg-white/3 transition-colors">
                        <td className="py-2.5 pr-4 font-medium text-white">{ex.name}</td>
                        <td className="py-2.5 px-3 text-center text-white/70">{ex.sets}</td>
                        <td className="py-2.5 px-3 text-center text-white/70">{ex.reps}</td>
                        <td className="py-2.5 px-3 text-center text-white/50">{ex.rest}</td>
                        <td className="py-2.5 pl-3 text-white/40 hidden sm:table-cell">{ex.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function AIWorkoutPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [generated, setGenerated] = useState<GeneratedWorkoutPlan | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [expandedSaved, setExpandedSaved] = useState<number | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: gymInfo } = useQuery<GymInfo>({
    queryKey: ["gym-info"],
    queryFn: () => api.get("/gym/info"),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: () => api.get("/members"),
  });

  const { data: savedPlans = [], isLoading: loadingSaved } = useQuery<SavedWorkoutPlan[]>({
    queryKey: ["ai-workout-plans"],
    queryFn: () => api.get("/ai-workout"),
  });

  const generateMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<{ plan: GeneratedWorkoutPlan }>("/ai-workout/generate", {
      age: Number(body.age), gender: body.gender, weight: body.weight,
      height: body.height, fitnessLevel: body.fitnessLevel,
      goal: body.goal, trainingDays: Number(body.trainingDays),
      location: body.location, equipment: body.equipment, injuries: body.injuries,
    }),
    onSuccess: ({ plan }) => {
      setGenerated(plan);
      setActiveWeek(0);
      setSavedMsg("");
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/ai-workout", {
      memberId: Number(form.memberId),
      age: Number(form.age), gender: form.gender,
      weight: form.weight, height: form.height,
      fitnessLevel: form.fitnessLevel, goal: form.goal,
      trainingDays: Number(form.trainingDays),
      plan: generated,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-workout-plans"] });
      setSavedMsg("Plan saved to member profile!");
      setTimeout(() => setSavedMsg(""), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ai-workout/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-workout-plans"] });
      setDeleteId(null);
    },
  });

  const canGenerate = form.age && form.gender && form.fitnessLevel && form.goal && form.trainingDays;
  const canSave = generated && form.memberId;
  const selectedMember = members.find(m => m.id === Number(form.memberId));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const has4WeekPlan = generated?.weeks && generated.weeks.length > 0;
  const currentWeek = has4WeekPlan ? generated!.weeks![activeWeek] : null;

  const isBasicPlan = gymInfo && (gymInfo.plan === "basic" || gymInfo.plan === "starter");

  if (isBasicPlan) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-10 max-w-md w-full">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/8">
            <Lock className="w-7 h-7 text-white/40" />
          </div>
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Pro Feature</p>
          <h2 className="text-xl font-black text-white mb-3">AI Workout Generator</h2>
          <p className="text-sm text-white/45 leading-relaxed mb-6">
            Upgrade your plan to access the 4-week AI workout generator — personalised programs for every member, instantly.
          </p>
          <div className="space-y-2 text-left mb-7">
            {["4-week progressive programs", "Goal, location & injury filtering", "Full sets/reps/rest breakdown", "Saved to member profiles"].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-white/50">
                <div className="w-4 h-4 rounded-full bg-white/6 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-2.5 h-2.5 text-white/30" />
                </div>
                {f}
              </div>
            ))}
          </div>
          <a href="mailto:fitpilot.saas@gmail.com?subject=Upgrade%20to%20Pro&body=Hi%20FitPilot%20Team%2C%20I%20would%20like%20to%20upgrade%20my%20plan%20to%20Pro.">
            <button className="w-full bg-[var(--gym-primary)] hover:opacity-90 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg" style={{ boxShadow: "0 8px 24px var(--gym-primary)40" }}>
              Upgrade to Pro
            </button>
          </a>
          <p className="text-xs text-white/25 mt-3">Contact us at fitpilot.saas@gmail.com</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "var(--gym-primary)", boxShadow: "0 4px 14px var(--gym-primary)40" }}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI Workout Generator</h1>
          <p className="text-xs text-white/40 mt-0.5">Generate personalised 4-week progressive training programs for your members</p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-5">
        <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">Member Details</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Member */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Member (optional)</label>
            <select value={form.memberId} onChange={set("memberId")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors">
              <option value="">— No specific member —</option>
              {members.filter(m => m.status === "active").map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Age */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Age *</label>
            <input type="number" min="10" max="100" placeholder="e.g. 28"
              value={form.age} onChange={set("age")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors" />
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Gender *</label>
            <select value={form.gender} onChange={set("gender")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Weight</label>
            <input type="text" placeholder="e.g. 75kg or 165lbs"
              value={form.weight} onChange={set("weight")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors" />
          </div>

          {/* Height */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Height</label>
            <input type="text" placeholder="e.g. 175cm or 5'9"
              value={form.height} onChange={set("height")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors" />
          </div>

          {/* Training days */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Training Days / Week *</label>
            <select value={form.trainingDays} onChange={set("trainingDays")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors">
              {[2,3,4,5,6].map(d => <option key={d} value={d}>{d} days/week</option>)}
            </select>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Training Location *</label>
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.map(l => (
              <button key={l.value}
                onClick={() => setForm(f => ({ ...f, location: l.value }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  form.location === l.value
                    ? "border-[var(--gym-primary)] bg-[var(--gym-primary)]/20 text-white"
                    : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}>
                {l.label} <span className="text-xs opacity-60">({l.desc})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Equipment (only show when not gym) */}
        {form.location !== "gym" && (
          <div className="space-y-2">
            <label className="text-xs text-white/50 font-medium flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Equipment Available</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map(e => (
                <button key={e.value}
                  onClick={() => setForm(f => ({ ...f, equipment: e.value }))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.equipment === e.value
                      ? "border-[var(--gym-primary)] bg-[var(--gym-primary)]/20 text-white"
                      : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                  }`}>
                  {e.label} <span className="text-xs opacity-60">({e.desc})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fitness level */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Fitness Level *</label>
          <div className="flex flex-wrap gap-2">
            {FITNESS_LEVELS.map(l => (
              <button key={l.value}
                onClick={() => setForm(f => ({ ...f, fitnessLevel: l.value }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  form.fitnessLevel === l.value
                    ? "border-[var(--gym-primary)] bg-[var(--gym-primary)]/20 text-white"
                    : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}>
                {l.label} <span className="text-xs opacity-60">({l.desc})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium">Goal *</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {GOALS.map(g => (
              <button key={g.value}
                onClick={() => setForm(f => ({ ...f, goal: g.value }))}
                className={`px-3 py-3 rounded-xl text-sm font-medium border transition-all text-left ${
                  form.goal === g.value ? `${g.bg} ${g.color} border-current` : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}>
                <Target className="w-4 h-4 mb-1 opacity-70" />
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Injuries */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 font-medium">Injuries / Limitations (optional)</label>
          <textarea
            rows={2}
            placeholder="e.g. lower back pain, bad left knee, shoulder impingement — exercises will be adapted accordingly"
            value={form.injuries} onChange={set("injuries")}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors resize-none" />
        </div>

        {generateMutation.isError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {(generateMutation.error as Error).message}
          </div>
        )}

        <button
          onClick={() => generateMutation.mutate(form)}
          disabled={!canGenerate || generateMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: canGenerate ? "var(--gym-primary)" : "rgba(255,255,255,0.08)" }}>
          {generateMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating 4-Week Program...</>
            : <><Zap className="w-4 h-4" /> Generate 4-Week Workout Program</>}
        </button>
      </div>

      {/* Generated Plan */}
      {generated && (
        <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ background: "linear-gradient(135deg, var(--gym-primary)15, transparent)" }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Dumbbell className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
                <span className="text-sm font-bold text-white">4-Week Training Program</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium`}
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
                  {goalLabel(generated.goal)}
                </span>
                <span className="text-xs text-white/40 capitalize">{generated.fitnessLevel}</span>
                <span className="text-xs text-white/40">·</span>
                <span className="text-xs text-white/40">{generated.trainingDays} training days/week</span>
                {generated.location && (
                  <>
                    <span className="text-xs text-white/40">·</span>
                    <span className="text-xs text-white/40 capitalize flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{generated.location}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {savedMsg && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {savedMsg}
                </div>
              )}
              <button
                onClick={() => { setGenerated(null); setForm(defaultForm); setActiveWeek(0); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              {canSave && (
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-60"
                  style={{ background: "var(--gym-primary)" }}>
                  {saveMutation.isPending
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                    : <><Save className="w-3.5 h-3.5" /> Save to {selectedMember?.name}</>}
                </button>
              )}
              {generated && !form.memberId && (
                <p className="text-xs text-white/30 w-full sm:w-auto">Select a member above to save</p>
              )}
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Warmup / Cooldown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5"><Zap className="w-3 h-3" /> Warm-up (Every Session)</p>
                <p className="text-xs text-white/60 leading-relaxed">{generated.warmup}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
                <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Cool-down (Every Session)</p>
                <p className="text-xs text-white/60 leading-relaxed">{generated.cooldown}</p>
              </div>
            </div>

            {/* Injury notes */}
            {generated.injuryNotes && (
              <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80 leading-relaxed">{generated.injuryNotes}</p>
              </div>
            )}

            {/* 4-Week tabs */}
            {has4WeekPlan && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {generated.weeks!.map((w, i) => (
                    <button key={i}
                      onClick={() => setActiveWeek(i)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        activeWeek === i
                          ? `${WEEK_BADGE[i]} border-current`
                          : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                      }`}>
                      Week {w.week}
                    </button>
                  ))}
                </div>

                {currentWeek && (
                  <div className="space-y-3">
                    <div className={`p-4 rounded-xl border ${WEEK_COLORS[activeWeek]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{currentWeek.theme}</p>
                          <p className="text-xs text-white/50 mt-0.5">{currentWeek.focus}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${WEEK_BADGE[activeWeek]}`}>
                          Wk {currentWeek.week}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 mt-3">
                        <ChevronRight className="w-3.5 h-3.5 text-white/40 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-white/50 leading-relaxed">{currentWeek.progressionNote}</p>
                      </div>
                    </div>

                    <WeekSchedule schedule={currentWeek.schedule} />
                  </div>
                )}
              </div>
            )}

            {/* Fallback for old format */}
            {!has4WeekPlan && generated.weeklySchedule && (
              <WeekSchedule schedule={generated.weeklySchedule} />
            )}

            {/* Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(generated.recoveryGuide || generated.trainingNotes) && (
                <div className="p-3 rounded-xl bg-white/4 border border-white/8">
                  <p className="text-xs font-semibold text-white/60 mb-1 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Recovery Guide</p>
                  <p className="text-xs text-white/50 leading-relaxed">{generated.recoveryGuide ?? generated.trainingNotes}</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-white/4 border border-white/8">
                <p className="text-xs font-semibold text-white/60 mb-1 flex items-center gap-1.5"><Info className="w-3 h-3" /> Nutrition Tip</p>
                <p className="text-xs text-white/50 leading-relaxed">{generated.nutritionTip}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Plans */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Saved Plans</h2>
          <span className="text-xs text-white/30">{savedPlans.length} plan{savedPlans.length !== 1 ? "s" : ""}</span>
        </div>

        {loadingSaved ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : savedPlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <Brain className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/30">No plans saved yet — generate one above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedPlans.map((sp) => {
              const planData = sp.plan as GeneratedWorkoutPlan;
              const isOpen = expandedSaved === sp.id;
              const is4Week = planData?.weeks && planData.weeks.length > 0;
              const displaySchedule = is4Week ? planData.weeks![0].schedule : planData?.weeklySchedule;
              return (
                <div key={sp.id} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => setExpandedSaved(isOpen ? null : sp.id)}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--gym-primary)20" }}>
                        <User className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{sp.memberName ?? "Unknown Member"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs font-medium ${goalColor(planData?.goal ?? "")}`}>{goalLabel(planData?.goal ?? "")}</span>
                          <span className="text-xs text-white/30">·</span>
                          <span className="text-xs text-white/30 capitalize">{sp.fitnessLevel}</span>
                          {sp.trainingDays && <><span className="text-xs text-white/30">·</span><span className="text-xs text-white/30">{sp.trainingDays}d/week</span></>}
                          {is4Week && <><span className="text-xs text-white/30">·</span><span className="text-xs text-violet-400">4-week program</span></>}
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/20 flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(sp.createdAt)}</span>
                        </div>
                      </div>
                      <div className="ml-auto flex-shrink-0">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    </button>

                    <button
                      onClick={() => setDeleteId(sp.id)}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/8 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
                          <p className="text-xs font-semibold text-amber-400 mb-1">Warm-up</p>
                          <p className="text-xs text-white/50 leading-relaxed">{planData?.warmup}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
                          <p className="text-xs font-semibold text-blue-400 mb-1">Cool-down</p>
                          <p className="text-xs text-white/50 leading-relaxed">{planData?.cooldown}</p>
                        </div>
                      </div>

                      {is4Week && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {planData.weeks!.map((w, i) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${WEEK_BADGE[i]}`}>
                              Week {w.week}: {w.theme}
                            </span>
                          ))}
                        </div>
                      )}

                      {displaySchedule && (
                        <div className="space-y-2">
                          {displaySchedule.map((day, i) => (
                            <div key={i} className={`rounded-xl border px-4 py-3 ${DAY_COLORS[day.type] ?? DAY_COLORS.rest}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-white/40 w-10">{day.day.slice(0,3)}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-white">{day.focus}</p>
                                    {day.type !== "rest" && <p className="text-xs text-white/40">{day.exercises.length} exercises</p>}
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${DAY_BADGE[day.type] ?? DAY_BADGE.rest}`}>{day.type}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-white/4 border border-white/8">
                        <p className="text-xs font-semibold text-white/50 mb-1">Nutrition Tip</p>
                        <p className="text-xs text-white/40 leading-relaxed">{planData?.nutritionTip}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Delete Plan</p>
                <p className="text-xs text-white/40 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-60">
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
