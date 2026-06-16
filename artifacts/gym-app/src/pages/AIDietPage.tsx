import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Salad, Droplets, Target, Loader2, Save, RotateCcw,
  Trash2, ChevronDown, ChevronUp, User, Calendar,
  AlertCircle, CheckCircle2, Zap, Flame, Wheat, Fish,
  Activity, Leaf, Lock, ArrowRight,
} from "lucide-react";
import { api } from "../lib/api.js";

interface GymInfo { plan: string; memberLimit: number | null; memberCount: number; }

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Member { id: number; name: string; email: string; status: string; }

interface FoodItem { food: string; amount: string; calories: number; protein: number; carbs: number; fats: number; }
interface Meal { name: string; time: string; calories: number; protein: number; items: FoodItem[]; }
interface GeneratedDietPlan {
  dailyCalories: number; protein: number; carbs: number; fats: number;
  hydration: string; bmi?: number; dietaryPreference?: string; activityLevel?: string;
  breakfast: Meal; lunch: Meal; dinner: Meal; snacks: Meal;
  notes: string; tips: string[];
}
interface SavedDietPlan {
  id: number; memberId: number; memberName: string | null;
  age: number | null; gender: string | null; goal: string | null;
  plan: GeneratedDietPlan; createdAt: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GOALS = [
  { value: "weight_loss",     label: "Weight Loss",    color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
  { value: "muscle_gain",     label: "Muscle Gain",    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  { value: "strength",        label: "Strength",        color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
  { value: "general_fitness", label: "General Fitness", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary",         label: "Sedentary",         desc: "Little or no exercise" },
  { value: "lightly_active",    label: "Lightly Active",    desc: "1–3 days/week" },
  { value: "moderately_active", label: "Moderately Active", desc: "3–5 days/week" },
  { value: "very_active",       label: "Very Active",       desc: "6–7 days/week" },
  { value: "extra_active",      label: "Extra Active",      desc: "Athlete / 2× daily" },
];

const DIETARY_PREFS = [
  { value: "standard",    label: "Standard",    desc: "All foods",             color: "text-white/70" },
  { value: "halal",       label: "Halal",        desc: "Halal certified",       color: "text-emerald-400" },
  { value: "vegetarian",  label: "Vegetarian",  desc: "No meat or fish",       color: "text-lime-400" },
  { value: "vegan",       label: "Vegan",        desc: "No animal products",    color: "text-green-400" },
];

const MEAL_ICONS: Record<string, React.ReactNode> = {
  Breakfast: <span className="text-lg">🌅</span>,
  Lunch:     <span className="text-lg">☀️</span>,
  Dinner:    <span className="text-lg">🌙</span>,
  Snacks:    <span className="text-lg">🍎</span>,
};

const defaultForm = {
  memberId: "", age: "", gender: "male", weight: "", height: "", goal: "general_fitness",
  activityLevel: "moderately_active", dietaryPreference: "standard",
};

function goalLabel(g: string) { return GOALS.find(x => x.value === g)?.label ?? g; }
function goalColor(g: string) { return GOALS.find(x => x.value === g)?.color ?? "text-white/60"; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function MacroBar({ protein, carbs, fats }: { protein: number; carbs: number; fats: number }) {
  const total = protein * 4 + carbs * 4 + fats * 9;
  const pPct = total ? (protein * 4 / total * 100) : 33;
  const cPct = total ? (carbs * 4 / total * 100)   : 34;
  const fPct = total ? (fats * 9 / total * 100)    : 33;
  return (
    <div className="space-y-1">
      <div className="flex rounded-full overflow-hidden h-2">
        <div style={{ width: `${pPct}%`, background: "#3b82f6" }} />
        <div style={{ width: `${cPct}%`, background: "#f59e0b" }} />
        <div style={{ width: `${fPct}%`, background: "#ef4444" }} />
      </div>
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-400" />Protein {Math.round(pPct)}%</span>
        <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400" />Carbs {Math.round(cPct)}%</span>
        <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />Fats {Math.round(fPct)}%</span>
      </div>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3">
          {MEAL_ICONS[meal.name] ?? <span>🍽️</span>}
          <div>
            <p className="text-sm font-semibold text-white">{meal.name}</p>
            <p className="text-xs text-white/30">{meal.time}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white">{meal.calories} kcal</p>
            <p className="text-xs text-blue-400">{meal.protein}g protein</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="sm:hidden flex justify-between mb-3 text-xs">
            <span className="text-white/60">{meal.calories} kcal</span>
            <span className="text-blue-400">{meal.protein}g protein</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/8">
                  <th className="text-left py-1.5 pr-3 font-medium">Food</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Amount</th>
                  <th className="text-right py-1.5 px-2 font-medium">kcal</th>
                  <th className="text-right py-1.5 px-2 font-medium text-blue-400/70">P(g)</th>
                  <th className="text-right py-1.5 px-2 font-medium text-amber-400/70">C(g)</th>
                  <th className="text-right py-1.5 pl-2 font-medium text-red-400/70">F(g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {meal.items.map((item, i) => (
                  <tr key={i} className="hover:bg-white/3 transition-colors">
                    <td className="py-2 pr-3 font-medium text-white">{item.food}</td>
                    <td className="py-2 pr-3 text-white/50">{item.amount}</td>
                    <td className="py-2 px-2 text-right text-white/70">{item.calories}</td>
                    <td className="py-2 px-2 text-right text-blue-400">{item.protein}</td>
                    <td className="py-2 px-2 text-right text-amber-400">{item.carbs}</td>
                    <td className="py-2 pl-2 text-right text-red-400">{item.fats}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold">
                  <td className="pt-2 pr-3 text-white/50">Total</td>
                  <td />
                  <td className="pt-2 px-2 text-right text-white">{meal.calories}</td>
                  <td className="pt-2 px-2 text-right text-blue-400">{meal.protein}</td>
                  <td className="pt-2 px-2 text-right text-amber-400">{meal.items.reduce((s,i)=>s+i.carbs,0)}</td>
                  <td className="pt-2 pl-2 text-right text-red-400">{meal.items.reduce((s,i)=>s+i.fats,0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function AIDietPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [generated, setGenerated] = useState<GeneratedDietPlan | null>(null);
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

  const { data: savedPlans = [], isLoading: loadingSaved } = useQuery<SavedDietPlan[]>({
    queryKey: ["ai-diet-plans"],
    queryFn: () => api.get("/ai-diet"),
  });

  const generateMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<{ plan: GeneratedDietPlan }>("/ai-diet/generate", {
      age: Number(body.age), gender: body.gender,
      weight: body.weight, height: body.height, goal: body.goal,
      activityLevel: body.activityLevel, dietaryPreference: body.dietaryPreference,
    }),
    onSuccess: ({ plan }) => {
      setGenerated(plan);
      setSavedMsg("");
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/ai-diet", {
      memberId: Number(form.memberId),
      age: Number(form.age), gender: form.gender,
      weight: form.weight, height: form.height, goal: form.goal,
      plan: generated,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-diet-plans"] });
      setSavedMsg("Diet plan saved to member profile!");
      setTimeout(() => setSavedMsg(""), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ai-diet/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-diet-plans"] });
      setDeleteId(null);
    },
  });

  const canGenerate = form.age && form.gender && form.goal;
  const canSave = generated && form.memberId;
  const selectedMember = members.find(m => m.id === Number(form.memberId));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const prefColor = DIETARY_PREFS.find(p => p.value === form.dietaryPreference)?.color ?? "text-white/70";

  const isBasicPlan = gymInfo && (gymInfo.plan === "basic" || gymInfo.plan === "starter");

  if (isBasicPlan) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-10 max-w-md w-full">
          <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/8">
            <Lock className="w-7 h-7 text-white/40" />
          </div>
          <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Pro Feature</p>
          <h2 className="text-xl font-black text-white mb-3">AI Diet Planner</h2>
          <p className="text-sm text-white/45 leading-relaxed mb-6">
            Upgrade your plan to access the personalised AI diet planner — calorie-accurate meal plans with full macro breakdowns for every member.
          </p>
          <div className="space-y-2 text-left mb-7">
            {["Standard, Vegetarian, Vegan & Halal templates", "TDEE calculation with 5 activity levels", "Full macro breakdown per meal", "BMI analysis & hydration targets"].map(f => (
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
          <Salad className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI Diet Planner</h1>
          <p className="text-xs text-white/40 mt-0.5">Generate science-backed nutrition plans tailored to your members' goals and dietary needs</p>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-5">
        <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">Member Details</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Age *</label>
            <input type="number" min="10" max="100" placeholder="e.g. 30"
              value={form.age} onChange={set("age")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Gender *</label>
            <select value={form.gender} onChange={set("gender")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Weight</label>
            <input type="text" placeholder="e.g. 70kg or 155lbs"
              value={form.weight} onChange={set("weight")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Height</label>
            <input type="text" placeholder="e.g. 170cm or 5'7"
              value={form.height} onChange={set("height")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[var(--gym-primary)]/50 transition-colors" />
          </div>
        </div>

        {/* Activity Level */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Activity Level *</label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_LEVELS.map(l => (
              <button key={l.value}
                onClick={() => setForm(f => ({ ...f, activityLevel: l.value }))}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  form.activityLevel === l.value
                    ? "border-[var(--gym-primary)] bg-[var(--gym-primary)]/20 text-white"
                    : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}>
                {l.label} <span className="opacity-60">· {l.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dietary Preference */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5" /> Dietary Preference *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DIETARY_PREFS.map(p => (
              <button key={p.value}
                onClick={() => setForm(f => ({ ...f, dietaryPreference: p.value }))}
                className={`px-3 py-3 rounded-xl text-sm font-medium border transition-all text-left ${
                  form.dietaryPreference === p.value
                    ? `border-current bg-white/8 ${p.color}`
                    : "border-white/10 bg-white/3 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}>
                <Leaf className="w-4 h-4 mb-1 opacity-60" />
                <p className="font-semibold">{p.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{p.desc}</p>
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Plan...</>
            : <><Salad className="w-4 h-4" /> Generate Diet Plan</>}
        </button>
      </div>

      {/* Generated Plan */}
      {generated && (
        <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ background: "linear-gradient(135deg, var(--gym-primary)15, transparent)" }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Salad className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
                <span className="text-sm font-bold text-white">Your Generated Diet Plan</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium ${goalColor(form.goal)}`}>{goalLabel(form.goal)}</span>
                {generated.dietaryPreference && (
                  <>
                    <span className="text-xs text-white/30">·</span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${prefColor}`}>
                      <Leaf className="w-3 h-3" />{generated.dietaryPreference}
                    </span>
                  </>
                )}
                {generated.activityLevel && (
                  <>
                    <span className="text-xs text-white/30">·</span>
                    <span className="text-xs text-white/50">{generated.activityLevel}</span>
                  </>
                )}
                {generated.bmi && (
                  <>
                    <span className="text-xs text-white/30">·</span>
                    <span className="text-xs text-white/50">BMI {generated.bmi}</span>
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
              <button onClick={() => { setGenerated(null); setForm(defaultForm); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              {canSave && (
                <button onClick={() => saveMutation.mutate()}
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

          <div className="p-5 space-y-5">
            {/* Macro summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Daily Calories", value: `${generated.dailyCalories}`, unit: "kcal", icon: <Flame className="w-4 h-4" />, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                { label: "Protein",  value: `${generated.protein}`,  unit: "g", icon: <Fish className="w-4 h-4" />,    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
                { label: "Carbohydrates", value: `${generated.carbs}`, unit: "g", icon: <Wheat className="w-4 h-4" />, color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
                { label: "Fats",     value: `${generated.fats}`,     unit: "g", icon: <Zap className="w-4 h-4" />,     color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
              ].map(stat => (
                <div key={stat.label} className={`rounded-xl border p-3 ${stat.bg}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${stat.color}`}>
                    {stat.icon}
                    <span className="text-xs font-medium">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}<span className="text-sm font-normal text-white/50 ml-1">{stat.unit}</span></p>
                </div>
              ))}
            </div>

            {/* Macro bar */}
            <div className="p-4 rounded-xl bg-white/4 border border-white/8">
              <p className="text-xs font-semibold text-white/50 mb-3">Macro Split</p>
              <MacroBar protein={generated.protein} carbs={generated.carbs} fats={generated.fats} />
            </div>

            {/* Hydration */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
              <Droplets className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-400 mb-0.5">Hydration Recommendation</p>
                <p className="text-xs text-white/60 leading-relaxed">{generated.hydration}</p>
              </div>
            </div>

            {/* Meals */}
            <div className="space-y-3">
              {(["breakfast","lunch","dinner","snacks"] as const).map(mealKey => {
                const meal = generated[mealKey];
                if (!meal) return null;
                return <MealCard key={mealKey} meal={meal} />;
              })}
            </div>

            {/* Notes & Tips */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white/4 border border-white/8">
                <p className="text-xs font-semibold text-white/50 mb-2">Nutrition Notes</p>
                <p className="text-xs text-white/50 leading-relaxed">{generated.notes}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/4 border border-white/8">
                <p className="text-xs font-semibold text-white/50 mb-2">Weekly Tips</p>
                <ul className="space-y-1.5">
                  {generated.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "var(--gym-primary)" }} />
                      {tip}
                    </li>
                  ))}
                </ul>
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
            <Salad className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/30">No diet plans saved yet — generate one above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedPlans.map((sp) => {
              const planData = sp.plan as GeneratedDietPlan;
              const isOpen = expandedSaved === sp.id;
              return (
                <div key={sp.id} className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => setExpandedSaved(isOpen ? null : sp.id)}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--gym-primary)20" }}>
                        <User className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{sp.memberName ?? "Unknown Member"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs font-medium ${goalColor(sp.goal ?? "")}`}>{goalLabel(sp.goal ?? "")}</span>
                          {planData && (
                            <>
                              <span className="text-xs text-white/30">·</span>
                              <span className="text-xs text-white/50 flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{planData.dailyCalories} kcal</span>
                              <span className="text-xs text-white/30">·</span>
                              <span className="text-xs text-blue-400">{planData.protein}g protein</span>
                              {planData.dietaryPreference && (
                                <>
                                  <span className="text-xs text-white/30">·</span>
                                  <span className="text-xs text-emerald-400 flex items-center gap-0.5"><Leaf className="w-3 h-3" />{planData.dietaryPreference}</span>
                                </>
                              )}
                            </>
                          )}
                          <span className="text-xs text-white/20">·</span>
                          <span className="text-xs text-white/20 flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(sp.createdAt)}</span>
                        </div>
                      </div>
                      <div className="ml-auto flex-shrink-0">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    </button>
                    <button onClick={() => setDeleteId(sp.id)}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {isOpen && planData && (
                    <div className="border-t border-white/8 p-4 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { l: "Calories", v: planData.dailyCalories, u: "kcal", c: "text-orange-400" },
                          { l: "Protein",  v: planData.protein,        u: "g",    c: "text-blue-400" },
                          { l: "Carbs",    v: planData.carbs,           u: "g",    c: "text-amber-400" },
                          { l: "Fats",     v: planData.fats,            u: "g",    c: "text-red-400" },
                        ].map(s => (
                          <div key={s.l} className="rounded-xl bg-white/4 border border-white/8 p-2.5 text-center">
                            <p className="text-xs text-white/40 mb-1">{s.l}</p>
                            <p className={`text-lg font-bold ${s.c}`}>{s.v}<span className="text-xs font-normal text-white/30 ml-0.5">{s.u}</span></p>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-xl bg-white/4 border border-white/8">
                        <MacroBar protein={planData.protein} carbs={planData.carbs} fats={planData.fats} />
                      </div>
                      {(["breakfast","lunch","dinner","snacks"] as const).map(mealKey => {
                        const meal = planData[mealKey];
                        if (!meal) return null;
                        return <MealCard key={mealKey} meal={meal} />;
                      })}
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/8 border border-blue-500/15 text-xs text-white/50">
                        <Droplets className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                        {planData.hydration}
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
                <p className="text-sm font-bold text-white">Delete Diet Plan</p>
                <p className="text-xs text-white/40 mt-0.5">This action cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/60 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(deleteId)}
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
