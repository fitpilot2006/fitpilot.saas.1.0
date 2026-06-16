import { useState, useRef, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import {
  Download, Calendar, CreditCard, Dumbbell, Activity, CheckCircle,
  AlertCircle, LogOut, User, Shield, Clock, ArrowRight, Brain, Salad,
  Zap, Loader2, Save, RotateCcw, ChevronDown, ChevronUp, Trash2,
  Target, CheckCircle2, Flame, Fish, Wheat, Droplets, TrendingUp, Info,
} from "lucide-react";
import { getUser, clearAuth } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { formatDate, daysUntil } from "../lib/utils.js";
import { useLocation } from "wouter";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Member {
  id: number; name: string; email: string; phone: string;
  membershipType: string; membershipExpiry: string; status: string;
  joinedAt: string; qrToken: string | null; workoutPlanId: number | null;
}
interface Attendance { id: number; memberId: number; memberName: string; checkInAt: string; }
interface Payment { id: number; memberId: number; amount: number; status: string; description: string | null; dueDate: string; paidAt: string | null; }
interface Branding { gymName: string; logoUrl: string | null; primaryColor: string; }

// AI types
type Goal = "weight_loss" | "muscle_gain" | "strength" | "general_fitness";
interface WorkoutExercise { name: string; sets: number; reps: string; rest: string; notes: string; }
interface WorkoutDay { day: string; focus: string; type: string; exercises: WorkoutExercise[]; }
interface WeekPlan { week: number; theme: string; focus: string; progressionNote: string; schedule: WorkoutDay[]; }
interface GeneratedWorkoutPlan {
  goal: string; fitnessLevel: string; trainingDays: number;
  weeks?: WeekPlan[];
  weeklySchedule?: WorkoutDay[]; warmup: string; cooldown: string;
  trainingNotes?: string; nutritionTip?: string;
}
interface SavedWorkoutPlan {
  id: number; memberName: string | null; goal: string | null;
  fitnessLevel: string | null; trainingDays: number | null;
  plan: GeneratedWorkoutPlan; createdAt: string;
}
interface FoodItem { food: string; amount: string; calories: number; protein: number; carbs: number; fats: number; }
interface Meal { name: string; time: string; calories: number; protein: number; items: FoodItem[]; }
interface GeneratedDietPlan {
  dailyCalories: number; protein: number; carbs: number; fats: number;
  hydration: string; breakfast: Meal; lunch: Meal; dinner: Meal; snacks: Meal;
  notes: string; tips: string[];
}
interface SavedDietPlan {
  id: number; memberName: string | null; goal: string | null;
  plan: GeneratedDietPlan; createdAt: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  vip: "text-amber-400 bg-amber-500/15 border-amber-500/25",
  premium: "text-violet-400 bg-violet-500/15 border-violet-500/25",
  standard: "text-blue-400 bg-blue-500/15 border-blue-500/25",
  basic: "text-slate-400 bg-slate-600/30 border-slate-500/25",
};

const GOALS: { value: Goal; label: string; color: string }[] = [
  { value: "weight_loss",     label: "Weight Loss",    color: "text-orange-400" },
  { value: "muscle_gain",     label: "Muscle Gain",    color: "text-blue-400"   },
  { value: "strength",        label: "Strength",        color: "text-red-400"    },
  { value: "general_fitness", label: "General Fitness", color: "text-emerald-400"},
];

const FITNESS_LEVELS = [
  { value: "beginner",     label: "Beginner"     },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced",     label: "Advanced"     },
];

const DAY_BADGE: Record<string, string> = {
  strength: "bg-red-500/20 text-red-400",
  cardio:   "bg-orange-500/20 text-orange-400",
  rest:     "bg-white/10 text-white/30",
};

function goalLabel(g: string) { return GOALS.find(x => x.value === g)?.label ?? g; }
function goalColor(g: string) { return GOALS.find(x => x.value === g)?.color ?? "text-white/60"; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── SMALL REUSABLE COMPONENTS ───────────────────────────────────────────────

const MacroBar = memo(({ protein, carbs, fats }: { protein: number; carbs: number; fats: number }) => {
  const total = protein * 4 + carbs * 4 + fats * 9 || 1;
  return (
    <div className="space-y-1">
      <div className="flex rounded-full overflow-hidden h-1.5">
        <div style={{ width: `${protein * 4 / total * 100}%`, background: "#3b82f6" }} />
        <div style={{ width: `${carbs * 4 / total * 100}%`,   background: "#f59e0b" }} />
        <div style={{ width: `${fats * 9 / total * 100}%`,    background: "#ef4444" }} />
      </div>
      <div className="flex gap-3 text-xs">
        <span className="text-blue-400">P: {protein}g</span>
        <span className="text-amber-400">C: {carbs}g</span>
        <span className="text-red-400">F: {fats}g</span>
      </div>
    </div>
  );
});

// ─── PROFILE TAB ─────────────────────────────────────────────────────────────

function ProfileTab({ member, attendance, payments, primary }: {
  member: Member; attendance: Attendance[]; payments: Payment[]; primary: string;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const visitsThisMonth = attendance.filter(a => new Date(a.checkInAt) >= monthStart).length;
  const expiryDays = daysUntil(member.membershipExpiry);
  const isExpired = expiryDays < 0;
  const isExpiringSoon = !isExpired && expiryDays <= 7;

  function downloadQR() {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${member.name.replace(/\s+/g, "_")}_MemberQR.png`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  return (
    <div className="space-y-4">
      {/* Membership Card */}
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background: `linear-gradient(135deg, ${primary}30 0%, ${primary}10 50%, transparent 100%)`,
          border: `1px solid ${primary}30`,
        }}
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-10" style={{ background: primary }} />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full opacity-5" style={{ background: primary }} />
        <div className="relative flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                member.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${member.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                {member.status === "active" ? "Active" : "Inactive"}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${TYPE_COLORS[member.membershipType] ?? TYPE_COLORS.basic}`}>
                {member.membershipType}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight truncate">{member.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{member.email}</p>
            <div className={`mt-3 flex items-center gap-1.5 text-xs ${isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-slate-400"}`}>
              <Calendar className="w-3.5 h-3.5" />
              {isExpired ? "Expired" : "Expires"} {formatDate(member.membershipExpiry)}
              {isExpiringSoon && <span className="font-semibold">— {expiryDays}d left!</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <User className="w-3.5 h-3.5" />Member since {formatDate(member.joinedAt)}
            </div>
          </div>
          <div ref={qrRef} className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="bg-white p-2.5 rounded-2xl shadow-xl">
              <QRCodeCanvas value={member.qrToken ?? `MEMBER-${member.id}`} size={80} level="M" includeMargin={false} />
            </div>
            <button onClick={downloadQR}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
              style={{ color: primary, borderColor: `${primary}40`, background: `${primary}10` }}>
              <Download className="w-3 h-3" /> Save QR
            </button>
          </div>
        </div>
      </div>

      {/* Expiry Alert */}
      {(isExpired || isExpiringSoon) && (
        <div className={`rounded-2xl p-4 border flex items-center gap-3 ${isExpired ? "bg-red-500/10 border-red-500/25" : "bg-amber-500/10 border-amber-500/25"}`}>
          <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isExpired ? "text-red-400" : "text-amber-400"}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isExpired ? "text-red-400" : "text-amber-400"}`}>
              {isExpired ? "Membership expired" : `${expiryDays} day${expiryDays !== 1 ? "s" : ""} until expiry`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Contact the gym to renew.</p>
          </div>
          <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isExpired ? "text-red-400" : "text-amber-400"}`} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "This Month", value: visitsThisMonth, icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Total Visits", value: attendance.length, icon: CheckCircle, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Days Left", value: isExpired ? "0" : expiryDays, icon: Clock,
            color: isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-emerald-400",
            bg: isExpired ? "bg-red-500/10" : isExpiringSoon ? "bg-amber-500/10" : "bg-emerald-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-slate-800 border border-white/5 rounded-2xl p-4 text-center">
            <div className={`w-8 h-8 ${bg} rounded-xl mx-auto mb-2 flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Attendance */}
      <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-emerald-500/15 rounded-lg flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Recent Visits</h3>
          <span className="ml-auto text-xs text-slate-500">{attendance.length} total</span>
        </div>
        {attendance.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No visits recorded yet</p>
        ) : (
          <div className="space-y-1.5">
            {[...attendance].slice(0, 7).map(a => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-900/40">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <p className="text-xs text-slate-300 flex-1">
                  {new Date(a.checkInAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(a.checkInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-blue-500/15 rounded-lg flex items-center justify-center">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No payments recorded</p>
        ) : (
          <div className="space-y-1.5">
            {[...payments].slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-900/40">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  p.status === "paid" ? "bg-emerald-400" : p.status === "overdue" ? "bg-red-400" : "bg-amber-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{p.description ?? "Membership payment"}</p>
                  <p className="text-xs text-slate-500">Due {formatDate(p.dueDate)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">${Number(p.amount).toFixed(2)}</p>
                  <p className={`text-xs capitalize ${
                    p.status === "paid" ? "text-emerald-400" : p.status === "overdue" ? "text-red-400" : "text-amber-400"
                  }`}>{p.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR footer */}
      <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}20` }}>
          <Shield className="w-4 h-4" style={{ color: primary }} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-white">Your QR code is your gym pass</p>
          <p className="text-xs text-slate-500 mt-0.5">Show it at the scanner for instant check-in</p>
        </div>
        <button onClick={downloadQR}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all flex-shrink-0"
          style={{ color: primary, borderColor: `${primary}40`, background: `${primary}10` }}>
          <Download className="w-3.5 h-3.5" /> Save
        </button>
      </div>
    </div>
  );
}

// ─── AI WORKOUT TAB ───────────────────────────────────────────────────────────

const defaultWorkoutForm = {
  age: "", gender: "male", weight: "", height: "",
  fitnessLevel: "beginner", goal: "general_fitness" as Goal, trainingDays: "3",
};

function AIWorkoutTab({ primary }: { primary: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultWorkoutForm);
  const [generated, setGenerated] = useState<GeneratedWorkoutPlan | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [activeWeek, setActiveWeek] = useState(0);
  const [expandedSaved, setExpandedSaved] = useState<number | null>(null);
  const [savedPlanWeek, setSavedPlanWeek] = useState<Record<number, number>>({});
  const [savedMsg, setSavedMsg] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: savedPlans = [], isLoading } = useQuery<SavedWorkoutPlan[]>({
    queryKey: ["ai-workout-me"],
    queryFn: () => api.get("/ai-workout/me"),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<{ plan: GeneratedWorkoutPlan }>("/ai-workout/generate", {
      age: Number(form.age), gender: form.gender, weight: form.weight,
      height: form.height, fitnessLevel: form.fitnessLevel,
      goal: form.goal, trainingDays: Number(form.trainingDays),
    }),
    onSuccess: ({ plan }) => {
      setGenerated(plan);
      setExpandedDay(null);
      setSavedMsg("");
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/ai-workout/me", {
      age: Number(form.age), gender: form.gender,
      weight: form.weight, height: form.height,
      fitnessLevel: form.fitnessLevel, goal: form.goal,
      trainingDays: Number(form.trainingDays), plan: generated,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-workout-me"] });
      setSavedMsg("Plan saved!");
      setTimeout(() => setSavedMsg(""), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ai-workout/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-workout-me"] });
      setDeleteId(null);
    },
  });

  const set = useCallback((k: keyof typeof defaultWorkoutForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value })), []);

  const canGenerate = form.age && form.fitnessLevel && form.goal && form.trainingDays;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: primary }}>
          <Brain className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">AI Workout Generator</h2>
          <p className="text-xs text-slate-400">Get a personalised weekly training plan</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-slate-800 border border-white/5 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Age *</label>
            <input type="number" min="10" max="100" placeholder="e.g. 28"
              value={form.age} onChange={set("age")}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Gender *</label>
            <select value={form.gender} onChange={set("gender")}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Weight</label>
            <input type="text" placeholder="e.g. 75kg"
              value={form.weight} onChange={set("weight")}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Height</label>
            <input type="text" placeholder="e.g. 175cm"
              value={form.height} onChange={set("height")}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Fitness Level *</label>
          <div className="flex gap-2">
            {FITNESS_LEVELS.map(l => (
              <button key={l.value}
                onClick={() => setForm(f => ({ ...f, fitnessLevel: l.value }))}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                  form.fitnessLevel === l.value
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/10 bg-white/3 text-white/40 hover:text-white/70"
                }`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Goal *</label>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(g => (
              <button key={g.value}
                onClick={() => setForm(f => ({ ...f, goal: g.value }))}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-all text-left px-3 flex items-center gap-2 ${
                  form.goal === g.value
                    ? `border-white/20 bg-white/8 ${g.color}`
                    : "border-white/8 bg-white/3 text-white/40 hover:text-white/70"
                }`}>
                <Target className="w-3 h-3 flex-shrink-0" />
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Training Days / Week *</label>
          <div className="flex gap-2">
            {[2,3,4,5,6].map(d => (
              <button key={d}
                onClick={() => setForm(f => ({ ...f, trainingDays: String(d) }))}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                  form.trainingDays === String(d)
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/8 bg-white/3 text-white/40 hover:text-white/70"
                }`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {generateMutation.isError && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> {(generateMutation.error as Error).message}
          </p>
        )}

        <button
          onClick={() => generateMutation.mutate()}
          disabled={!canGenerate || generateMutation.isPending}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ background: primary }}>
          {generateMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Zap className="w-4 h-4" /> Generate My Plan</>}
        </button>
      </div>

      {/* Generated Plan Preview */}
      {generated && (
        <div className="bg-slate-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between"
            style={{ background: `${primary}15` }}>
            <div>
              <p className="text-sm font-bold text-white">Your Plan</p>
              <p className={`text-xs mt-0.5 ${goalColor(generated.goal)}`}>{goalLabel(generated.goal)} · {generated.fitnessLevel} · {generated.trainingDays}d/week</p>
            </div>
            <div className="flex items-center gap-2">
              {savedMsg && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {savedMsg}
                </span>
              )}
              <button onClick={() => { setGenerated(null); setForm(defaultWorkoutForm); }}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition-all"
                style={{ background: primary }}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          </div>

          {/* Warmup/Cooldown */}
          <div className="grid grid-cols-2 gap-2 p-4 pb-0">
            <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
              <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Warm-up</p>
              <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{generated.warmup}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
              <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Cool-down</p>
              <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{generated.cooldown}</p>
            </div>
          </div>

          {/* Week Navigation — shows tabs for 4-week plans */}
          {generated.weeks && generated.weeks.length > 1 && (
            <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-1">
              {generated.weeks.map((w, idx) => (
                <button key={idx}
                  onClick={() => { setActiveWeek(idx); setExpandedDay(null); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    activeWeek === idx
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/8 bg-white/3 text-white/30 hover:text-white/70"
                  }`}>
                  Week {idx + 1}
                  <span className="block text-[10px] font-normal opacity-60 leading-tight mt-0.5">{w.theme.split(" ").slice(0,2).join(" ")}</span>
                </button>
              ))}
            </div>
          )}
          {generated.weeks?.[activeWeek]?.progressionNote && (
            <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-violet-500/8 border border-violet-500/15 flex items-start gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-300/70 leading-relaxed">{generated.weeks[activeWeek].progressionNote}</p>
            </div>
          )}
          {/* Schedule */}
          <div className="p-4 space-y-2">
            {(generated.weeks ? generated.weeks[activeWeek]?.schedule ?? [] : generated.weeklySchedule ?? []).map((day, i) => (
              <div key={day.day} className={`rounded-xl border transition-all ${
                day.type === "rest" ? "border-white/8 bg-white/2" :
                day.type === "cardio" ? "border-orange-500/20 bg-orange-500/4" :
                "border-white/10 bg-white/4"
              }`}>
                <button
                  className="w-full flex items-center px-3 py-2.5 text-left gap-3"
                  onClick={() => setExpandedDay(expandedDay === i ? null : i)}
                  disabled={day.type === "rest"}>
                  <span className="text-xs font-bold text-white/30 w-8 flex-shrink-0">{day.day.slice(0,3)}</span>
                  <span className="text-sm font-medium text-white flex-1 truncate">{day.focus}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${DAY_BADGE[day.type] ?? DAY_BADGE.rest}`}>
                    {day.type}
                  </span>
                  {day.type !== "rest" && (expandedDay === i ? <ChevronUp className="w-3.5 h-3.5 text-white/20 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />)}
                </button>
                {expandedDay === i && day.type !== "rest" && (
                  <div className="px-3 pb-3 overflow-x-auto">
                    <table className="w-full text-xs min-w-[300px]">
                      <thead><tr className="text-white/25 border-b border-white/8">
                        <th className="text-left py-1.5 pr-3 font-medium">Exercise</th>
                        <th className="text-center py-1.5 px-2 font-medium">Sets</th>
                        <th className="text-center py-1.5 px-2 font-medium">Reps</th>
                        <th className="text-center py-1.5 pl-2 font-medium">Rest</th>
                      </tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {day.exercises.map((ex, j) => (
                          <tr key={j}>
                            <td className="py-2 pr-3 font-medium text-white">{ex.name}</td>
                            <td className="py-2 px-2 text-center text-white/60">{ex.sets}</td>
                            <td className="py-2 px-2 text-center text-white/60">{ex.reps}</td>
                            <td className="py-2 pl-2 text-center text-white/40">{ex.rest}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="px-4 pb-4">
            <div className="p-3 rounded-xl bg-white/4 border border-white/8">
              <p className="text-xs font-semibold text-white/40 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Training Notes</p>
              <p className="text-xs text-white/40 leading-relaxed">{generated.trainingNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Saved Plans */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider">My Saved Plans</p>
          <span className="text-xs text-white/20">{savedPlans.length}</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/20" /></div>
        ) : savedPlans.length === 0 ? (
          <div className="bg-slate-800 border border-dashed border-white/10 rounded-2xl p-8 text-center">
            <Brain className="w-7 h-7 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/25">Generate and save a plan to see it here</p>
          </div>
        ) : (
          savedPlans.map((sp) => {
            const planData = sp.plan as GeneratedWorkoutPlan;
            const isOpen = expandedSaved === sp.id;
            return (
              <div key={sp.id} className="bg-slate-800 border border-white/8 rounded-2xl overflow-hidden">
                <div className="flex items-center px-4 py-3 gap-3">
                  <button className="flex-1 text-left min-w-0" onClick={() => setExpandedSaved(isOpen ? null : sp.id)}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${goalColor(planData?.goal ?? "")}`}>{goalLabel(planData?.goal ?? "")}</span>
                      <span className="text-xs text-white/25">·</span>
                      <span className="text-xs text-white/35 capitalize">{sp.fitnessLevel}</span>
                      {sp.trainingDays && <><span className="text-xs text-white/25">·</span><span className="text-xs text-white/35">{sp.trainingDays}d/wk</span></>}
                    </div>
                    <p className="text-xs text-white/20 mt-0.5">{fmtDate(sp.createdAt)}</p>
                  </button>
                  <button onClick={() => setExpandedSaved(isOpen ? null : sp.id)} className="text-white/20 hover:text-white/50">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setDeleteId(sp.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isOpen && planData && (
                  <div className="border-t border-white/8 p-4 space-y-2">
                    {/* Week selector for 4-week plans */}
                    {planData.weeks && planData.weeks.length > 1 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {planData.weeks.map((_w, wi) => (
                          <button key={wi}
                            onClick={() => setSavedPlanWeek(prev => ({ ...prev, [sp.id]: wi }))}
                            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              (savedPlanWeek[sp.id] ?? 0) === wi
                                ? "border-white/30 bg-white/10 text-white"
                                : "border-white/8 text-white/35 hover:text-white/70"
                            }`}>
                            Week {wi + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Progression note for selected week */}
                    {planData.weeks?.[savedPlanWeek[sp.id] ?? 0]?.progressionNote && (
                      <div className="px-3 py-2 rounded-xl bg-violet-500/8 border border-violet-500/15 flex items-start gap-2">
                        <TrendingUp className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-violet-300/70 leading-relaxed">{planData.weeks![savedPlanWeek[sp.id] ?? 0].progressionNote}</p>
                      </div>
                    )}
                    {/* Days — exercises always visible */}
                    {(planData.weeks
                      ? planData.weeks[savedPlanWeek[sp.id] ?? 0]?.schedule ?? []
                      : planData.weeklySchedule ?? []
                    ).map((day, i) => (
                      <div key={i} className={`rounded-xl border ${day.type === "rest" ? "border-white/8" : "border-white/10 bg-white/3"}`}>
                        <div className="flex items-center px-3 py-2.5 gap-3">
                          <span className="text-[10px] font-bold text-white/25 w-8 flex-shrink-0 uppercase tracking-wide">{day.day.slice(0,3)}</span>
                          <span className="text-xs font-semibold text-white flex-1 leading-tight">{day.focus}</span>
                          {day.type !== "rest" && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize flex-shrink-0 ${DAY_BADGE[day.type] ?? DAY_BADGE.rest}`}>
                              {day.type}
                            </span>
                          )}
                        </div>
                        {day.type !== "rest" && day.exercises && day.exercises.length > 0 && (
                          <div className="px-3 pb-3 overflow-x-auto">
                            <table className="w-full text-xs min-w-[260px]">
                              <thead><tr className="text-white/25 border-b border-white/8">
                                <th className="text-left py-1 pr-2 font-medium">Exercise</th>
                                <th className="text-center py-1 px-1.5 font-medium">Sets</th>
                                <th className="text-center py-1 px-1.5 font-medium">Reps</th>
                                <th className="text-center py-1 pl-1.5 font-medium">Rest</th>
                              </tr></thead>
                              <tbody className="divide-y divide-white/5">
                                {day.exercises.map((ex, j) => (
                                  <tr key={j}>
                                    <td className="py-1.5 pr-2 font-medium text-white/90 leading-tight">{ex.name}</td>
                                    <td className="py-1.5 px-1.5 text-center text-white/60">{ex.sets}</td>
                                    <td className="py-1.5 px-1.5 text-center text-white/60">{ex.reps}</td>
                                    <td className="py-1.5 pl-1.5 text-center text-white/40">{ex.rest}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Warmup */}
                    {planData.warmup && (
                      <div className="rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 flex items-start gap-2">
                        <span className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest mt-0.5 flex-shrink-0 w-14">Warm-up</span>
                        <p className="text-xs text-white/35 leading-relaxed">{planData.warmup}</p>
                      </div>
                    )}
                    {/* Cooldown */}
                    {planData.cooldown && (
                      <div className="rounded-xl border border-white/8 bg-white/2 px-3 py-2.5 flex items-start gap-2">
                        <span className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest mt-0.5 flex-shrink-0 w-14">Cool-down</span>
                        <p className="text-xs text-white/35 leading-relaxed">{planData.cooldown}</p>
                      </div>
                    )}
                    {/* Training notes */}
                    {planData.trainingNotes && (
                      <div className="p-2.5 rounded-xl bg-white/3 border border-white/8">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Training Notes</p>
                        <p className="text-xs text-white/30 leading-relaxed">{planData.trainingNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-bold text-white mb-1">Delete this plan?</p>
            <p className="text-xs text-white/40 mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:text-white transition-all">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-60">
                {deleteMutation.isPending ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI DIET TAB ─────────────────────────────────────────────────────────────

const defaultDietForm = { age: "", gender: "male", weight: "", height: "", goal: "general_fitness" as Goal };

function AIDietTab({ primary }: { primary: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultDietForm);
  const [generated, setGenerated] = useState<GeneratedDietPlan | null>(null);
  const [expandedSaved, setExpandedSaved] = useState<number | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [openMeal, setOpenMeal] = useState<string | null>("breakfast");

  const { data: savedPlans = [], isLoading } = useQuery<SavedDietPlan[]>({
    queryKey: ["ai-diet-me"],
    queryFn: () => api.get("/ai-diet/me"),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<{ plan: GeneratedDietPlan }>("/ai-diet/generate", {
      age: Number(form.age), gender: form.gender,
      weight: form.weight, height: form.height, goal: form.goal,
    }),
    onSuccess: ({ plan }) => { setGenerated(plan); setSavedMsg(""); setOpenMeal("breakfast"); },
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/ai-diet/me", {
      age: Number(form.age), gender: form.gender,
      weight: form.weight, height: form.height, goal: form.goal, plan: generated,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-diet-me"] });
      setSavedMsg("Saved!");
      setTimeout(() => setSavedMsg(""), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ai-diet/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-diet-me"] }); setDeleteId(null); },
  });

  const set = useCallback((k: keyof typeof defaultDietForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value })), []);

  const canGenerate = form.age && form.goal;

  const MEAL_EMOJI: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍎" };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: primary }}>
          <Salad className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">AI Diet Planner</h2>
          <p className="text-xs text-slate-400">Get a personalised nutrition plan</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-slate-800 border border-white/5 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "age" as const,    label: "Age *",    type: "number", placeholder: "e.g. 28"      },
            { k: "weight" as const, label: "Weight",   type: "text",   placeholder: "e.g. 70kg"    },
            { k: "height" as const, label: "Height",   type: "text",   placeholder: "e.g. 170cm"   },
          ].map(({ k, label, type, placeholder }) => (
            <div key={k} className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">{label}</label>
              <input type={type} placeholder={placeholder} value={form[k]} onChange={set(k)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Gender *</label>
            <select value={form.gender} onChange={set("gender")}
              className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-medium">Goal *</label>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map(g => (
              <button key={g.value}
                onClick={() => setForm(f => ({ ...f, goal: g.value }))}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all text-left flex items-center gap-2 ${
                  form.goal === g.value
                    ? `border-white/20 bg-white/8 ${g.color}`
                    : "border-white/8 bg-white/3 text-white/40 hover:text-white/70"
                }`}>
                <Target className="w-3 h-3 flex-shrink-0" />
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {generateMutation.isError && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> {(generateMutation.error as Error).message}
          </p>
        )}

        <button
          onClick={() => generateMutation.mutate()}
          disabled={!canGenerate || generateMutation.isPending}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          style={{ background: primary }}>
          {generateMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Salad className="w-4 h-4" /> Generate My Diet Plan</>}
        </button>
      </div>

      {/* Generated Plan */}
      {generated && (
        <div className="bg-slate-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between" style={{ background: `${primary}15` }}>
            <div>
              <p className="text-sm font-bold text-white">Your Diet Plan</p>
              <p className={`text-xs mt-0.5 ${goalColor(form.goal)}`}>{goalLabel(form.goal)}</p>
            </div>
            <div className="flex items-center gap-2">
              {savedMsg && <span className="text-xs text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{savedMsg}</span>}
              <button onClick={() => { setGenerated(null); setForm(defaultDietForm); }}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 transition-all"
                style={{ background: primary }}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          </div>

          {/* Macros */}
          <div className="grid grid-cols-4 gap-2 p-4 pb-3">
            {[
              { l: "Calories", v: generated.dailyCalories, u: "kcal", icon: <Flame className="w-3.5 h-3.5" />, c: "text-orange-400" },
              { l: "Protein",  v: generated.protein,        u: "g",    icon: <Fish className="w-3.5 h-3.5" />,    c: "text-blue-400"   },
              { l: "Carbs",    v: generated.carbs,           u: "g",    icon: <Wheat className="w-3.5 h-3.5" />,   c: "text-amber-400"  },
              { l: "Fats",     v: generated.fats,            u: "g",    icon: <Zap className="w-3.5 h-3.5" />,     c: "text-red-400"    },
            ].map(s => (
              <div key={s.l} className="rounded-xl bg-white/4 border border-white/8 p-2 text-center">
                <div className={`flex items-center justify-center mb-1 ${s.c}`}>{s.icon}</div>
                <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
                <p className="text-xs text-white/25">{s.u}</p>
              </div>
            ))}
          </div>

          <div className="px-4 pb-3">
            <MacroBar protein={generated.protein} carbs={generated.carbs} fats={generated.fats} />
          </div>

          {/* Hydration */}
          <div className="mx-4 mb-3 flex items-start gap-2 p-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15 text-xs text-white/50">
            <Droplets className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />{generated.hydration}
          </div>

          {/* Meals */}
          <div className="px-4 pb-4 space-y-2">
            {(["breakfast","lunch","dinner","snacks"] as const).map(mealKey => {
              const meal = generated[mealKey];
              if (!meal) return null;
              const isOpen = openMeal === mealKey;
              return (
                <div key={mealKey} className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
                  <button className="w-full flex items-center px-3 py-2.5 text-left gap-3"
                    onClick={() => setOpenMeal(isOpen ? null : mealKey)}>
                    <span className="text-base">{MEAL_EMOJI[mealKey]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{meal.name}</p>
                      <p className="text-xs text-white/30">{meal.time}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-white">{meal.calories} kcal</p>
                      <p className="text-xs text-blue-400">{meal.protein}g pro</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/20 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 overflow-x-auto">
                      <table className="w-full text-xs min-w-[280px]">
                        <thead><tr className="text-white/25 border-b border-white/8">
                          <th className="text-left py-1.5 pr-2 font-medium">Food</th>
                          <th className="text-left py-1.5 pr-2 font-medium">Amount</th>
                          <th className="text-right py-1.5 px-1 font-medium">kcal</th>
                          <th className="text-right py-1.5 pl-1 font-medium text-blue-400/60">P</th>
                          <th className="text-right py-1.5 pl-1 font-medium text-amber-400/60">C</th>
                          <th className="text-right py-1.5 pl-1 font-medium text-red-400/60">F</th>
                        </tr></thead>
                        <tbody className="divide-y divide-white/5">
                          {meal.items.map((item, j) => (
                            <tr key={j}>
                              <td className="py-1.5 pr-2 font-medium text-white/80">{item.food}</td>
                              <td className="py-1.5 pr-2 text-white/40">{item.amount}</td>
                              <td className="py-1.5 px-1 text-right text-white/60">{item.calories}</td>
                              <td className="py-1.5 pl-1 text-right text-blue-400">{item.protein}</td>
                              <td className="py-1.5 pl-1 text-right text-amber-400">{item.carbs}</td>
                              <td className="py-1.5 pl-1 text-right text-red-400">{item.fats}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tips */}
          {generated.tips?.length > 0 && (
            <div className="mx-4 mb-4 p-3 rounded-xl bg-white/3 border border-white/8">
              <p className="text-xs font-semibold text-white/40 mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Tips</p>
              <ul className="space-y-1">
                {generated.tips.slice(0,3).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/35">
                    <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0 bg-white/20" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Saved Plans */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider">My Saved Plans</p>
          <span className="text-xs text-white/20">{savedPlans.length}</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/20" /></div>
        ) : savedPlans.length === 0 ? (
          <div className="bg-slate-800 border border-dashed border-white/10 rounded-2xl p-8 text-center">
            <Salad className="w-7 h-7 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/25">Generate and save a plan to see it here</p>
          </div>
        ) : (
          savedPlans.map((sp) => {
            const planData = sp.plan as GeneratedDietPlan;
            const isOpen = expandedSaved === sp.id;
            return (
              <div key={sp.id} className="bg-slate-800 border border-white/8 rounded-2xl overflow-hidden">
                <div className="flex items-center px-4 py-3 gap-3">
                  <button className="flex-1 text-left min-w-0" onClick={() => setExpandedSaved(isOpen ? null : sp.id)}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${goalColor(sp.goal ?? "")}`}>{goalLabel(sp.goal ?? "")}</span>
                      {planData && <><span className="text-xs text-white/25">·</span><span className="text-xs text-white/35 flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{planData.dailyCalories} kcal</span></>}
                    </div>
                    <p className="text-xs text-white/20 mt-0.5">{fmtDate(sp.createdAt)}</p>
                  </button>
                  <button onClick={() => setExpandedSaved(isOpen ? null : sp.id)} className="text-white/20 hover:text-white/50">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setDeleteId(sp.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {isOpen && planData && (
                  <div className="border-t border-white/8 p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { l: "kcal", v: planData.dailyCalories, c: "text-orange-400" },
                        { l: "Protein", v: `${planData.protein}g`, c: "text-blue-400" },
                        { l: "Carbs", v: `${planData.carbs}g`, c: "text-amber-400" },
                        { l: "Fats", v: `${planData.fats}g`, c: "text-red-400" },
                      ].map(s => (
                        <div key={s.l} className="rounded-xl bg-white/4 border border-white/8 p-2 text-center">
                          <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
                          <p className="text-xs text-white/25">{s.l}</p>
                        </div>
                      ))}
                    </div>
                    <MacroBar protein={planData.protein} carbs={planData.carbs} fats={planData.fats} />
                    {/* Meals — items always visible */}
                    <div className="space-y-2">
                      {(["breakfast","lunch","dinner","snacks"] as const).map(mealKey => {
                        const meal = planData[mealKey];
                        if (!meal) return null;
                        return (
                          <div key={mealKey} className="rounded-xl bg-white/3 border border-white/8 overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/6">
                              <span className="text-sm">{MEAL_EMOJI[mealKey]}</span>
                              <span className="text-xs font-semibold text-white flex-1">{meal.name}</span>
                              <span className="text-xs text-white/50">{meal.calories} kcal</span>
                              <span className="text-xs text-blue-400">{meal.protein}g pro</span>
                            </div>
                            {meal.items && meal.items.length > 0 && (
                              <div className="px-3 pb-2 pt-1 overflow-x-auto">
                                <table className="w-full text-xs min-w-[240px]">
                                  <thead><tr className="text-white/25 border-b border-white/8">
                                    <th className="text-left py-1 pr-2 font-medium">Food</th>
                                    <th className="text-left py-1 pr-2 font-medium">Amount</th>
                                    <th className="text-right py-1 px-1 font-medium">kcal</th>
                                    <th className="text-right py-1 pl-1 font-medium text-blue-400/70">P</th>
                                    <th className="text-right py-1 pl-1 font-medium text-amber-400/70">C</th>
                                    <th className="text-right py-1 pl-1 font-medium text-red-400/70">F</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-white/5">
                                    {meal.items.map((item, k) => (
                                      <tr key={k}>
                                        <td className="py-1.5 pr-2 text-white/80 leading-tight">{item.food}</td>
                                        <td className="py-1.5 pr-2 text-white/40">{item.amount}</td>
                                        <td className="py-1.5 px-1 text-right text-white/60">{item.calories}</td>
                                        <td className="py-1.5 pl-1 text-right text-blue-400">{item.protein}g</td>
                                        <td className="py-1.5 pl-1 text-right text-amber-400">{item.carbs}g</td>
                                        <td className="py-1.5 pl-1 text-right text-red-400">{item.fats}g</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Hydration */}
                    {planData.hydration && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15">
                        <Droplets className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-white/50 leading-relaxed">{planData.hydration}</p>
                      </div>
                    )}
                    {/* Notes */}
                    {planData.notes && (
                      <div className="px-3 py-2.5 rounded-xl bg-white/3 border border-white/8">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-xs text-white/35 leading-relaxed">{planData.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-bold text-white mb-1">Delete this diet plan?</p>
            <p className="text-xs text-white/40 mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:text-white transition-all">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-60">
                {deleteMutation.isPending ? "…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Tab = "profile" | "workout" | "diet";

export default function MemberPortalPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const user = getUser();

  // Efficient member-specific endpoints (no more loading all gym data!)
  const { data: member, isLoading, isError } = useQuery<Member>({
    queryKey: ["member-me"],
    queryFn: () => api.get("/members/me"),
    retry: 1,
  });
  const { data: attendance = [] } = useQuery<Attendance[]>({
    queryKey: ["attendance-me"],
    queryFn: () => api.get("/attendance/me"),
    enabled: !!member,
  });
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments-me"],
    queryFn: () => api.get("/payments/me"),
    enabled: !!member,
  });
  const { data: branding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api.get("/branding"),
    staleTime: 300_000,
  });

  const primary = branding?.primaryColor ?? "#7c3aed";
  const gymName = branding?.gymName ?? "Your Gym";

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "My Profile", icon: <User className="w-4 h-4" /> },
    { id: "workout", label: "AI Workout", icon: <Brain className="w-4 h-4" /> },
    { id: "diet",    label: "AI Diet",    icon: <Salad className="w-4 h-4" /> },
  ];

  if (isLoading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ background: primary }}>
          <Dumbbell className="w-6 h-6 text-white animate-pulse" />
        </div>
        <p className="text-slate-400 text-sm">Loading your portal...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-slate-900 lg:bg-slate-900/90 lg:backdrop-blur-xl border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={gymName} className="w-8 h-8 rounded-xl object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: primary }}>
                <Dumbbell className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-white leading-tight">{gymName}</p>
              <p className="text-xs text-slate-500 leading-tight">Member Portal</p>
            </div>
          </div>
          <button
            onClick={() => { clearAuth(); navigate("/login"); }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {isError || !member ? (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-white font-semibold">Member profile not found</p>
            <p className="text-slate-400 text-sm mt-1">Contact your gym admin to link your account.</p>
          </div>
        ) : (
          <>
            {activeTab === "profile" && (
              <ProfileTab member={member} attendance={attendance} payments={payments} primary={primary} />
            )}
            {activeTab === "workout" && <AIWorkoutTab primary={primary} />}
            {activeTab === "diet"    && <AIDietTab    primary={primary} />}
          </>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-xl border-t border-white/8">
        <div className="max-w-lg mx-auto flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-all ${
                activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              style={activeTab === tab.id ? { color: primary } : undefined}
            >
              {tab.icon}
              <span className="text-[10px] leading-none">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: primary }} />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
