import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Pencil, X, CheckCircle, TrendingUp, Clock, AlertCircle,
  DollarSign, Filter,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../lib/api.js";
import { formatDate } from "../lib/utils.js";

interface Payment {
  id: number; memberId: number; memberName: string; amount: number;
  status: string; description: string | null; dueDate: string; paidAt: string | null;
  createdAt: string; currency?: string;
}
interface Member { id: number; name: string; }

const CURRENCIES = [
  { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
  { code: "AED", symbol: "د.إ" }, { code: "INR", symbol: "₹" }, { code: "PKR", symbol: "Rs" },
  { code: "SAR", symbol: "﷼" }, { code: "CAD", symbol: "CA$" }, { code: "AUD", symbol: "A$" },
];

function formatAmount(amount: number, currency = "USD") {
  const cur = CURRENCIES.find(c => c.code === currency);
  return `${cur?.symbol ?? "$"}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const emptyForm = { memberId: "", amount: "", description: "", dueDate: "", status: "pending", currency: "USD" };

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; dot: string }> = {
    paid: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
    pending: { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
    overdue: { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
  };
  const c = cfg[status] ?? { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${c.bg} ${c.text} border border-current border-opacity-20`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 shadow-xl">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-bold text-white">${payload[0]?.value?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payments", statusFilter],
    queryFn: () => api.get(`/payments${statusFilter ? `?status=${statusFilter}` : ""}`),
  });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members-all"],
    queryFn: () => api.get("/members"),
  });

  const filtered = payments.filter(p =>
    !search || p.memberName.toLowerCase().includes(search.toLowerCase()) ||
    (p.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === "overdue").reduce((s, p) => s + p.amount, 0);

  // Monthly revenue chart data from payments
  const monthlyData = (() => {
    const map: Record<string, number> = {};
    payments.filter(p => p.status === "paid").forEach(p => {
      const month = new Date(p.paidAt ?? p.createdAt).toLocaleDateString("en", { month: "short", year: "2-digit" });
      map[month] = (map[month] ?? 0) + p.amount;
    });
    return Object.entries(map).slice(-6).map(([name, value]) => ({ name, value }));
  })();

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/payments", { ...data, memberId: Number(data.memberId), amount: Number(data.amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      api.patch(`/payments/${id}`, { ...data, amount: Number(data.amount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["revenue-chart"] });
      closeModal();
    },
  });
  const markPaidMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/payments/${id}`, { status: "paid", paidAt: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["revenue-chart"] });
    },
  });

  function openAdd() { setForm(emptyForm); setEditing(null); setModal("add"); }
  function openEdit(p: Payment) {
    setForm({ memberId: p.memberId.toString(), amount: p.amount.toString(), description: p.description ?? "", dueDate: p.dueDate, status: p.status, currency: p.currency ?? "USD" });
    setEditing(p); setModal("edit");
  }
  function closeModal() { setModal(null); setEditing(null); }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutError = (createMutation.error || updateMutation.error) as Error | null;

  const FILTER_TABS = [
    { value: "", label: "All", count: payments.length },
    { value: "paid", label: "Paid", count: payments.filter(p => p.status === "paid").length },
    { value: "pending", label: "Pending", count: payments.filter(p => p.status === "pending").length },
    { value: "overdue", label: "Overdue", count: payments.filter(p => p.status === "overdue").length },
  ];

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-slate-400 text-sm mt-0.5">{payments.length} total records</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "var(--gym-primary)", boxShadow: "0 4px 16px var(--gym-primary-20)" }}>
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-500/15 rounded-lg"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /></div>
            <p className="text-xs text-slate-400">Collected</p>
          </div>
          <p className="text-xl font-bold text-emerald-400 tabular-nums">${totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-500/15 rounded-lg"><Clock className="w-3.5 h-3.5 text-amber-400" /></div>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
          <p className="text-xl font-bold text-amber-400 tabular-nums">${totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-red-500/15 rounded-lg"><AlertCircle className="w-3.5 h-3.5 text-red-400" /></div>
            <p className="text-xs text-slate-400">Overdue</p>
          </div>
          <p className="text-xl font-bold text-red-400 tabular-nums">${totalOverdue.toLocaleString()}</p>
        </div>
      </div>

      {/* Revenue Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Revenue Collected</h2>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-slate-800 border border-white/5 rounded-xl p-1">
          {FILTER_TABS.map(({ value, label, count }) => (
            <button key={value} onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === value ? "text-white" : "text-slate-400 hover:text-white"}`}
              style={statusFilter === value ? { background: "var(--gym-primary)" } : {}}>
              {label}
              <span className={`ml-1 ${statusFilter === value ? "text-white/70" : "text-slate-600"}`}>{count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments..."
            className="w-full bg-slate-800 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/30" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-white/5 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No payment records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium text-left">Member</th>
                  <th className="px-4 py-3 font-medium text-left">Amount</th>
                  <th className="px-4 py-3 font-medium text-left hidden md:table-cell">Description</th>
                  <th className="px-4 py-3 font-medium text-left hidden sm:table-cell">Due Date</th>
                  <th className="px-4 py-3 font-medium text-left">Status</th>
                  <th className="px-4 py-3 font-medium text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isOverdueDue = p.status !== "paid" && new Date(p.dueDate) < new Date();
                  return (
                    <tr key={p.id} className={`border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors ${isOverdueDue && p.status !== "overdue" ? "bg-red-500/3" : ""}`}>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-white">{p.memberName}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-white tabular-nums">{formatAmount(p.amount, p.currency)}</p>
                        {p.currency && p.currency !== "USD" && <p className="text-xs text-slate-500">{p.currency}</p>}
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-slate-400 text-xs">{p.description ?? "—"}</td>
                      <td className="px-4 py-3.5 hidden sm:table-cell text-slate-400 text-xs">{formatDate(p.dueDate)}</td>
                      <td className="px-4 py-3.5"><StatusPill status={p.status} /></td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {p.status !== "paid" && (
                            <button onClick={() => markPaidMutation.mutate(p.id)} title="Mark as paid"
                              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => openEdit(p)} title="Edit"
                            className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-slate-900 z-10">
              <div>
                <h2 className="text-lg font-bold text-white">{modal === "edit" ? "Edit Payment" : "Add Payment"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{modal === "edit" ? "Update payment record" : "Create a new payment record"}</p>
              </div>
              <button onClick={closeModal} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (modal === "edit" && editing) updateMutation.mutate({ id: editing.id, data: form }); else createMutation.mutate(form); }} className="p-6 space-y-4">
              {mutError && <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">{mutError.message}</div>}

              {modal === "add" && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Member *</label>
                  <select value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} required
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                    <option value="">Select member...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Amount *</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.00"
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Due Date *</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required
                  className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Monthly membership fee..."
                  className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/30" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-medium transition-all">Cancel</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "var(--gym-primary)" }}>
                  {isPending ? "Saving..." : modal === "edit" ? "Save Changes" : "Add Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
