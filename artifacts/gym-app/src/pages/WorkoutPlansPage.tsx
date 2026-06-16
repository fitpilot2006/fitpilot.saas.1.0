import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Dumbbell, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/utils.js";

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  day?: string | null;
  notes?: string | null;
}

interface WorkoutPlan {
  id: number;
  name: string;
  description: string | null;
  level: string;
  durationWeeks: number;
  exercises: Exercise[];
  createdAt: string;
}

const levelColor: Record<string, string> = {
  beginner: "text-green-400 bg-green-500/10",
  intermediate: "text-yellow-400 bg-yellow-500/10",
  advanced: "text-red-400 bg-red-500/10",
};

const emptyForm = { name: "", description: "", level: "beginner", durationWeeks: "4" };
const emptyExercise: Exercise = { name: "", sets: 3, reps: "10", day: "", notes: "" };

export default function WorkoutPlansPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<WorkoutPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: plans = [], isLoading } = useQuery<WorkoutPlan[]>({
    queryKey: ["workout-plans"],
    queryFn: () => api.get("/workout-plans"),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/workout-plans", { ...form, durationWeeks: Number(form.durationWeeks), exercises }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout-plans"] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/workout-plans/${editing!.id}`, { ...form, durationWeeks: Number(form.durationWeeks), exercises }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout-plans"] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/workout-plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["workout-plans"] }); setDeleteId(null); },
  });

  function openAdd() { setForm(emptyForm); setExercises([]); setEditing(null); setModal("add"); }
  function openEdit(p: WorkoutPlan) {
    setForm({ name: p.name, description: p.description ?? "", level: p.level, durationWeeks: p.durationWeeks.toString() });
    setExercises(p.exercises ?? []);
    setEditing(p); setModal("edit");
  }
  function closeModal() { setModal(null); setEditing(null); }

  function addExercise() { setExercises(ex => [...ex, { ...emptyExercise }]); }
  function removeExercise(i: number) { setExercises(ex => ex.filter((_, j) => j !== i)); }
  function updateExercise(i: number, field: keyof Exercise, value: string | number) {
    setExercises(ex => ex.map((e, j) => j === i ? { ...e, [field]: value } : e));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modal === "edit") updateMutation.mutate();
    else createMutation.mutate();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutError = (createMutation.error || updateMutation.error) as Error | null;

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workout Plans</h1>
          <p className="text-slate-400 text-sm mt-1">{plans.length} plans created</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95" style={{ background: "var(--gym-primary)" }}>
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: "var(--gym-primary)", borderTopColor: "transparent" }} />
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 py-12 text-center text-slate-500">
            No workout plans yet. Create your first one!
          </div>
        ) : plans.map(plan => (
          <div key={plan.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-start justify-between p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Dumbbell className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gym-primary)" }} />
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${levelColor[plan.level] ?? "text-slate-400 bg-slate-700"}`}>
                    {plan.level}
                  </span>
                </div>
                {plan.description && <p className="text-sm text-slate-400 mt-1">{plan.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>{plan.durationWeeks} weeks</span>
                  <span>{plan.exercises?.length ?? 0} exercises</span>
                  <span>Created {formatDate(plan.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => setExpanded(expanded === plan.id ? null : plan.id)} className="text-slate-400 hover:text-white transition-colors">
                  {expanded === plan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(plan)} className="text-slate-400 hover:text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setDeleteId(plan.id)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {expanded === plan.id && plan.exercises?.length > 0 && (
              <div className="border-t border-slate-700 p-4">
                <div className="space-y-2">
                  {plan.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm text-slate-300 bg-slate-700/50 rounded-lg px-3 py-2">
                      <span className="font-medium flex-1">{ex.name}</span>
                      <span className="text-slate-400">{ex.sets} sets × {ex.reps}</span>
                      {ex.day && <span className="text-slate-500">{ex.day}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">{modal === "edit" ? "Edit Plan" : "New Workout Plan"}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {mutError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">{mutError.message}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Plan Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Level</label>
                  <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Duration (weeks)</label>
                  <input type="number" min="1" max="52" value={form.durationWeeks} onChange={e => setForm(f => ({ ...f, durationWeeks: e.target.value }))} required
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20 resize-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-slate-300">Exercises</h3>
                  <button type="button" onClick={addExercise}
                    className="text-xs flex items-center gap-1 font-medium transition-colors hover:opacity-80"
                    style={{ color: "var(--gym-primary)" }}>
                    <Plus className="w-3.5 h-3.5" /> Add Exercise
                  </button>
                </div>
                <div className="space-y-2">
                  {exercises.map((ex, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-700/50 rounded-lg p-2">
                      <input value={ex.name} onChange={e => updateExercise(i, "name", e.target.value)} placeholder="Exercise name" required
                        className="col-span-4 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/20" />
                      <input type="number" value={ex.sets} onChange={e => updateExercise(i, "sets", Number(e.target.value))} placeholder="Sets" min={1}
                        className="col-span-2 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/20" />
                      <input value={ex.reps} onChange={e => updateExercise(i, "reps", e.target.value)} placeholder="Reps/time" required
                        className="col-span-3 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/20" />
                      <input value={ex.day ?? ""} onChange={e => updateExercise(i, "day", e.target.value)} placeholder="Day"
                        className="col-span-2 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/20" />
                      <button type="button" onClick={() => removeExercise(i)} className="col-span-1 text-slate-500 hover:text-red-400 flex justify-center">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-all active:scale-95" style={{ background: "var(--gym-primary)" }}>
                  {isPending ? "Saving..." : modal === "edit" ? "Save Changes" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Workout Plan</h3>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
