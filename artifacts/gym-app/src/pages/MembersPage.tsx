import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Pencil, Trash2, X, QrCode, Download,
  User, Phone, Mail, Calendar, Shield, ChevronDown, Copy, CheckCheck,
} from "lucide-react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { api } from "../lib/api.js";
import { formatDate, daysUntil, membershipStatusColor, cn } from "../lib/utils.js";

interface DashboardStats { memberJoinCode?: string; }

interface Member {
  id: number; name: string; email: string; phone: string;
  membershipType: string; membershipExpiry: string; status: string;
  joinedAt: string; workoutPlanId: number | null; notes: string | null;
  photoUrl: string | null; qrToken: string | null; emergencyContact: string | null;
  memberCode: string | null;
}

const MEMBERSHIP_TYPES = ["basic", "standard", "premium", "vip"];
const COUNTRY_CODES = [
  { code: "+1", flag: "🇺🇸", label: "US" },
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+91", flag: "🇮🇳", label: "IN" },
  { code: "+971", flag: "🇦🇪", label: "AE" },
  { code: "+92", flag: "🇵🇰", label: "PK" },
  { code: "+966", flag: "🇸🇦", label: "SA" },
  { code: "+49", flag: "🇩🇪", label: "DE" },
  { code: "+33", flag: "🇫🇷", label: "FR" },
  { code: "+61", flag: "🇦🇺", label: "AU" },
  { code: "+1", flag: "🇨🇦", label: "CA" },
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+60", flag: "🇲🇾", label: "MY" },
  { code: "+65", flag: "🇸🇬", label: "SG" },
];

const DURATION_PRESETS = [
  { label: "1 Month", months: 1 },
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "12 Months", months: 12 },
];

const emptyForm = {
  name: "", email: "", phone: "", countryCode: "+1",
  membershipType: "basic", membershipExpiry: "", workoutPlanId: "",
  notes: "", status: "active", emergencyContact: "",
};

function Avatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-orange-500", "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    expired: "bg-red-500/15 text-red-400 border-red-500/25",
    suspended: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cfg[status] ?? "bg-slate-500/15 text-slate-400 border-slate-500/25"}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === "active" ? "bg-emerald-400" : status === "expired" ? "bg-red-400" : "bg-amber-400"}`} />
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, string> = {
    vip: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    premium: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    standard: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    basic: "bg-slate-600/40 text-slate-400 border-slate-600/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${cfg[type] ?? cfg.basic}`}>
      {type}
    </span>
  );
}

export default function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "expired" | "suspended">("all");
  const [modal, setModal] = useState<"add" | "edit" | "qr" | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [qrMember, setQrMember] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const dlRef = useRef<HTMLDivElement>(null);

  const { data: dashStats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats"),
    staleTime: 60_000,
  });

  function copyJoinCode() {
    if (dashStats?.memberJoinCode) {
      navigator.clipboard.writeText(dashStats.memberJoinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }

  const statusFilter = tab === "all" ? "" : tab;
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["members", statusFilter],
    queryFn: () => api.get(`/members${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const filtered = members.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  const counts = {
    all: members.length,
    active: members.filter(m => m.status === "active").length,
    expired: members.filter(m => m.status === "expired").length,
    suspended: members.filter(m => m.status === "suspended").length,
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/members", {
      ...data,
      phone: `${data.countryCode} ${data.phone}`.trim(),
      workoutPlanId: data.workoutPlanId ? Number(data.workoutPlanId) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      api.patch(`/members/${id}`, { ...data, workoutPlanId: data.workoutPlanId ? Number(data.workoutPlanId) : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/members/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); setDeleteId(null); },
  });

  function openAdd() { setForm(emptyForm); setEditing(null); setModal("add"); }
  function openEdit(m: Member) {
    setForm({ name: m.name, email: m.email, phone: m.phone, countryCode: "+1", membershipType: m.membershipType, membershipExpiry: m.membershipExpiry, workoutPlanId: m.workoutPlanId?.toString() ?? "", notes: m.notes ?? "", status: m.status, emergencyContact: m.emergencyContact ?? "" });
    setEditing(m); setModal("edit");
  }
  function openQr(m: Member) { setQrMember(m); setModal("qr"); }
  function closeModal() { setModal(null); setEditing(null); setQrMember(null); }

  function setDuration(months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setForm(f => ({ ...f, membershipExpiry: d.toISOString().split("T")[0] }));
  }

  function downloadQR() {
    const canvas = dlRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !qrMember) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${qrMember.name.replace(/\s+/g, "_")}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (modal === "edit" && editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutError = (createMutation.error || updateMutation.error) as Error | null;

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "expired", label: "Expired" },
    { key: "suspended", label: "Suspended" },
  ];

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-slate-400 text-sm mt-0.5">{members.length} total · {counts.active} active</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg"
          style={{ background: "var(--gym-primary, #dc2626)", boxShadow: "0 4px 16px color-mix(in srgb, var(--gym-primary, #dc2626) 30%, transparent)" }}>
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      <div className="flex gap-1 bg-slate-800 border border-white/5 rounded-xl p-1 w-fit">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === key ? "text-white shadow" : "text-slate-400 hover:text-white"}`}
            style={tab === key ? { background: "var(--gym-primary, #dc2626)" } : {}}>
            {label}
            <span className={`ml-1.5 text-xs ${tab === key ? "text-white/70" : "text-slate-600"}`}>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..."
          className="w-full bg-slate-800 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:bg-slate-800" />
      </div>

      <div className="bg-slate-800 border border-white/5 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-slate-800 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <User className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No members found</p>
            {search && <p className="text-slate-600 text-xs mt-1">Try a different search term</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium text-left">Member</th>
                  <th className="px-4 py-3 font-medium text-left hidden lg:table-cell">Code</th>
                  <th className="px-4 py-3 font-medium text-left hidden md:table-cell">Contact</th>
                  <th className="px-4 py-3 font-medium text-left hidden sm:table-cell">Plan</th>
                  <th className="px-4 py-3 font-medium text-left">Expiry</th>
                  <th className="px-4 py-3 font-medium text-left">Status</th>
                  <th className="px-4 py-3 font-medium text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const days = daysUntil(m.membershipExpiry);
                  return (
                    <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name} photoUrl={m.photoUrl} />
                          <div>
                            <p className="font-medium text-white">{m.name}</p>
                            <p className="text-xs text-slate-500 hidden sm:block">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {m.memberCode ? (
                          <span className="font-mono text-xs font-semibold text-white/70 bg-white/5 border border-white/10 px-2 py-1 rounded-lg">
                            {m.memberCode}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="text-xs">{m.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell"><TypeBadge type={m.membershipType} /></td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm text-slate-300">{formatDate(m.membershipExpiry)}</p>
                          <p className={`text-xs mt-0.5 ${days <= 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-slate-600"}`}>
                            {days <= 0 ? "Expired" : days <= 7 ? `${days}d left` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={m.status} /></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openQr(m)} title="View QR" className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(m)} title="Edit" className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(m.id)} title="Delete" className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
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
      {(modal === "add" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-slate-900 z-10">
              <div>
                <h2 className="text-lg font-bold text-white">{modal === "edit" ? "Edit Member" : "Add New Member"}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{modal === "edit" ? "Update member details" : "Fill in member information"}</p>
              </div>
              <button onClick={closeModal} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-all"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {mutError && <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">{mutError.message}</div>}

              {modal === "add" && dashStats?.memberJoinCode && (
                <div className="relative overflow-hidden bg-gradient-to-r from-blue-500/12 via-blue-500/6 to-transparent border border-blue-500/20 rounded-xl p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Member Join Code</p>
                      <p className="text-lg font-bold text-white font-mono tracking-[0.25em] mt-0.5">{dashStats.memberJoinCode}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Share this code so members can self-register</p>
                    </div>
                    <button type="button" onClick={copyJoinCode}
                      className="flex items-center gap-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-400 text-xs font-semibold px-3 py-2 rounded-lg transition-all active:scale-95 flex-shrink-0">
                      {codeCopied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {codeCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Full Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="John Doe"
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="john@example.com"
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Phone *</label>
                  <div className="flex gap-1">
                    <select value={form.countryCode} onChange={e => setForm(f => ({ ...f, countryCode: e.target.value }))}
                      className="bg-slate-800 border border-white/8 rounded-xl px-2 py-2.5 text-white text-xs focus:outline-none focus:border-white/20 w-20 flex-shrink-0">
                      {COUNTRY_CODES.map((c, i) => (
                        <option key={i} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required placeholder="555 0100"
                      className="flex-1 bg-slate-800 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Membership Plan *</label>
                  <select value={form.membershipType} onChange={e => setForm(f => ({ ...f, membershipType: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                    {MEMBERSHIP_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Expiry Date *</label>
                  <input type="date" value={form.membershipExpiry} onChange={e => setForm(f => ({ ...f, membershipExpiry: e.target.value }))} required
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20" />
                </div>

                {/* Duration Quick-Pick */}
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-2">Quick Duration</p>
                  <div className="flex gap-2 flex-wrap">
                    {DURATION_PRESETS.map(({ label, months }) => (
                      <button key={months} type="button" onClick={() => setDuration(months)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-white/10 border border-white/8 hover:border-white/20 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all active:scale-95">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {modal === "edit" && editing?.memberCode && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Member Code</label>
                    <div className="flex items-center gap-2 bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5">
                      <span className="font-mono text-sm font-bold text-white/80 tracking-widest flex-1">{editing.memberCode}</span>
                      <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">Read-only</span>
                    </div>
                  </div>
                )}
                {modal === "edit" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Emergency Contact</label>
                  <input type="text" value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="Name & phone"
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes..."
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20 resize-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-medium transition-all">Cancel</button>
                <button type="submit" disabled={isPending}
                  className="flex-1 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: "var(--gym-primary, #dc2626)", boxShadow: "0 4px 16px color-mix(in srgb, var(--gym-primary, #dc2626) 25%, transparent)" }}>
                  {isPending ? "Saving..." : modal === "edit" ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {modal === "qr" && qrMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-xs shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-base font-bold text-white">Member QR Code</h2>
              <button onClick={closeModal} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <Avatar name={qrMember.name} photoUrl={qrMember.photoUrl} size="lg" />
              <div className="text-center">
                <p className="font-semibold text-white">{qrMember.name}</p>
                <TypeBadge type={qrMember.membershipType} />
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCodeSVG value={qrMember.qrToken ?? `MEMBER-${qrMember.id}`} size={180} level="M" />
              </div>
              {/* Hidden canvas for download */}
              <div ref={dlRef} className="absolute opacity-0 pointer-events-none">
                <QRCodeCanvas value={qrMember.qrToken ?? `MEMBER-${qrMember.id}`} size={400} level="H" />
              </div>
              <p className="text-xs text-slate-500 font-mono truncate max-w-full">{qrMember.qrToken ?? `MEMBER-${qrMember.id}`}</p>
              <p className="text-xs text-slate-500 text-center">
                Expires: <span className="text-white">{formatDate(qrMember.membershipExpiry)}</span>
              </p>
              <StatusBadge status={qrMember.status} />
              <button onClick={downloadQR}
                className="flex items-center gap-2 w-full justify-center border rounded-xl py-2.5 text-sm font-medium transition-all hover:text-white hover:opacity-90"
                style={{ background: "var(--gym-primary-10)", borderColor: "var(--gym-primary-20)", color: "var(--gym-primary)" }}>
                <Download className="w-4 h-4" /> Download QR Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-1">Delete Member</h3>
            <p className="text-slate-400 text-sm text-center mb-6">This action cannot be undone. All member data will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-medium transition-all">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
