import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, LogOut, Building2, Key, Plus, Trash2, Ban, CheckCircle,
  Users, Activity, Calendar, AlertCircle,
  Edit3, X, ChevronRight, Send, FileText, Eye, KeyRound,
  Download, Upload, Database, HardDrive, RefreshCw, AlertTriangle,
} from "lucide-react";
import { clearPaAuth, getPaUser, setAuth, setImpersonating } from "../../lib/auth.js";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/utils.js";
import { getPaToken } from "../../lib/auth.js";

interface Gym {
  id: number; name: string; slug: string; plan: string; status: string;
  memberJoinCode: string | null; memberLimit: number | null;
  subscriptionExpiry: string | null; createdAt: string;
  memberCount: number; activeMembers: number;
  latestSub: { plan: string; endDate: string; status: string } | null;
}
interface AccessCode {
  id: number; code: string; label: string | null;
  plan: string; trialDays: number;
  active: boolean; used: boolean; usedAt: string | null; createdAt: string;
}
interface PlatformStats {
  totalGyms: number; activeGyms: number; suspendedGyms: number;
  unusedCodes: number; totalMembers: number; activeMembers: number;
  pendingApplications: number;
}
interface Subscription {
  id: number; gymId: number; gymName: string; plan: string;
  startDate: string; endDate: string; status: string; notes: string | null; createdAt: string;
}
interface GymApplication {
  id: number; gymName: string; ownerName: string; phone: string; countryCode: string;
  email: string; address: string | null; planRequest: string | null; notes: string | null;
  status: string; assignedAccessCode: string | null; assignedExpiry: string | null;
  assignedMemberLimit: number | null; rejectionReason: string | null; createdAt: string;
}
interface BackupHealth {
  status: string; checkedAt: string;
  database?: { provider: string; name: string; version: string; connected: boolean };
  tables: Record<string, number>;
}
interface ImportResult {
  success: boolean; totalInserted: number; totalSkipped: number; totalErrors: number;
  summary: Record<string, { inserted: number; skipped: number; errors: string[] }>;
}

const PLANS = ["basic", "pro", "enterprise"];
const SUB_DURATIONS = [
  { label: "1 Month", months: 1 },
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "12 Months", months: 12 },
];

const TABLE_EXPORTS = [
  { key: "gyms", label: "Gyms" },
  { key: "members", label: "Members" },
  { key: "payments", label: "Payments" },
  { key: "attendance", label: "Attendance" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "access_codes", label: "Access Codes" },
];

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-white/8 rounded-2xl p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

type TabKey = "overview" | "gyms" | "codes" | "subscriptions" | "applications" | "backup";

export default function PlatformAdminDashboard() {
  const qc = useQueryClient();
  const paUser = getPaUser();
  const [tab, setTab] = useState<TabKey>("overview");
  const [codeLabel, setCodeLabel] = useState("");
  const [codePlan, setCodePlan] = useState("basic");
  const [codeTrialDays, setCodeTrialDays] = useState("30");
  const [editGym, setEditGym] = useState<Gym | null>(null);
  const [editForm, setEditForm] = useState({ plan: "", memberLimit: "", subscriptionExpiry: "", status: "" });
  const [subModal, setSubModal] = useState<Gym | null>(null);
  const [subForm, setSubForm] = useState({ plan: "pro", startDate: new Date().toISOString().split("T")[0], endDate: addMonths(1), notes: "" });
  const [approveModal, setApproveModal] = useState<GymApplication | null>(null);
  const [approveForm, setApproveForm] = useState({ assignedExpiry: "", assignedMemberLimit: "" });
  const [rejectModal, setRejectModal] = useState<GymApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [credsModal, setCredsModal] = useState<Gym | null>(null);
  const [credsForm, setCredsForm] = useState({ email: "", password: "" });
  const [credsSuccess, setCredsSuccess] = useState(false);

  // Confirmation dialogs
  const [deleteCodeConfirm, setDeleteCodeConfirm] = useState<AccessCode | null>(null);
  const [toggleGymConfirm, setToggleGymConfirm] = useState<{ gym: Gym; newStatus: string } | null>(null);
  const [deleteGymConfirm, setDeleteGymConfirm] = useState<Gym | null>(null);
  const [deleteGymNameInput, setDeleteGymNameInput] = useState("");

  // Backup state
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ["pa-stats"],
    queryFn: () => api.get("/platform-admin/stats", true),
    refetchInterval: 60_000,
  });
  const { data: gyms = [], isLoading: gymsLoading } = useQuery<Gym[]>({
    queryKey: ["pa-gyms"],
    queryFn: () => api.get("/platform-admin/gyms", true),
  });
  const { data: codes = [], isLoading: codesLoading } = useQuery<AccessCode[]>({
    queryKey: ["pa-codes"],
    queryFn: () => api.get("/platform-admin/access-codes", true),
  });
  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ["pa-subscriptions"],
    queryFn: () => api.get("/platform-admin/subscriptions", true),
  });
  const { data: applications = [], isLoading: appsLoading } = useQuery<GymApplication[]>({
    queryKey: ["pa-applications"],
    queryFn: () => api.get("/platform-admin/applications", true),
    refetchInterval: 60_000,
  });
  const { data: backupHealth, refetch: refetchHealth, isFetching: healthLoading } = useQuery<BackupHealth>({
    queryKey: ["pa-backup-health"],
    queryFn: () => api.get("/platform-admin/backup/health", true),
    enabled: tab === "backup",
  });

  const toggleGymMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/platform-admin/gyms/${id}`, { status }, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-gyms"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      setToggleGymConfirm(null);
    },
  });
  const updateGymMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof editForm }) =>
      api.patch(`/platform-admin/gyms/${id}`, { plan: data.plan, memberLimit: data.memberLimit || null, subscriptionExpiry: data.subscriptionExpiry || null, status: data.status }, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa-gyms"] }); setEditGym(null); },
  });
  const createCodeMutation = useMutation({
    mutationFn: () => api.post("/platform-admin/access-codes", { label: codeLabel || null, plan: codePlan, trialDays: Number(codeTrialDays) || 30 }, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-codes"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      setCodeLabel(""); setCodePlan("basic"); setCodeTrialDays("30");
    },
  });
  const deleteCodeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/platform-admin/access-codes/${id}`, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-codes"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      setDeleteCodeConfirm(null);
    },
  });
  const createSubMutation = useMutation({
    mutationFn: (gymId: number) => api.post("/platform-admin/subscriptions", { gymId, ...subForm }, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa-gyms"] }); qc.invalidateQueries({ queryKey: ["pa-subscriptions"] }); setSubModal(null); },
  });
  const approveAppMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof approveForm }) =>
      api.patch(`/platform-admin/applications/${id}`, { action: "approve", assignedExpiry: data.assignedExpiry || null, assignedMemberLimit: data.assignedMemberLimit || null }, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa-applications"] }); qc.invalidateQueries({ queryKey: ["pa-codes"] }); qc.invalidateQueries({ queryKey: ["pa-stats"] }); setApproveModal(null); },
  });
  const rejectAppMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.patch(`/platform-admin/applications/${id}`, { action: "reject", rejectionReason: reason }, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pa-applications"] }); qc.invalidateQueries({ queryKey: ["pa-stats"] }); setRejectModal(null); },
  });

  const impersonateMutation = useMutation({
    mutationFn: (gymId: number) => api.post(`/platform-admin/impersonate/${gymId}`, {}, true),
    onSuccess: (data: { token: string; user: any; gymName: string }) => {
      setAuth(data.token, data.user);
      setImpersonating(data.gymName);
      window.location.href = "/dashboard";
    },
  });

  const deleteGymMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ success: boolean; gymName: string }>(`/platform-admin/gyms/${id}`, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-gyms"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      qc.invalidateQueries({ queryKey: ["pa-subscriptions"] });
      setDeleteGymConfirm(null);
      setDeleteGymNameInput("");
    },
  });

  const credsMutation = useMutation({
    mutationFn: ({ gymId, data }: { gymId: number; data: typeof credsForm }) =>
      api.patch(`/platform-admin/gyms/${gymId}/credentials`, { email: data.email || undefined, password: data.password || undefined }, true),
    onSuccess: () => {
      setCredsSuccess(true);
      qc.invalidateQueries({ queryKey: ["pa-gyms"] });
      setTimeout(() => { setCredsModal(null); setCredsSuccess(false); setCredsForm({ email: "", password: "" }); }, 1500);
    },
  });

  function handleLogout() { clearPaAuth(); window.location.href = "/platform-admin"; }
  function openEdit(g: Gym) {
    setEditForm({ plan: g.plan, memberLimit: g.memberLimit?.toString() ?? "", subscriptionExpiry: g.subscriptionExpiry ?? "", status: g.status });
    setEditGym(g);
  }

  async function handleExportFull() {
    setExportLoading("full");
    try {
      const token = getPaToken();
      const res = await fetch("/api/platform-admin/backup/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gymflow-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastExportTime(new Date().toLocaleString());
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExportLoading(null);
    }
  }

  async function handleExportTable(tableKey: string, format: "csv" | "json") {
    setExportLoading(`${tableKey}-${format}`);
    try {
      const token = getPaToken();
      const res = await fetch(`/api/platform-admin/backup/export/${tableKey}?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gymflow-${tableKey}-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExportLoading(null);
    }
  }

  async function handleImport(file: File) {
    setImportLoading(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.post<ImportResult>("/platform-admin/backup/import", data, true);
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["pa-gyms"] });
      qc.invalidateQueries({ queryKey: ["pa-stats"] });
      qc.invalidateQueries({ queryKey: ["pa-codes"] });
      qc.invalidateQueries({ queryKey: ["pa-backup-health"] });
    } catch (e) {
      setImportError((e as Error).message ?? "Import failed");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const pendingApps = applications.filter(a => a.status === "pending");

  const tabs: { key: TabKey; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "gyms", label: "Gyms", icon: Building2 },
    { key: "applications", label: "Applications", icon: FileText, badge: pendingApps.length },
    { key: "codes", label: "Access Codes", icon: Key },
    { key: "subscriptions", label: "Subscriptions", icon: Calendar },
    { key: "backup", label: "Backup", icon: HardDrive },
  ];

  const inputCls = "w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50";

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-white/5 px-4 lg:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Shield className="text-white w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white text-sm">Platform Admin</span>
            {paUser && <span className="text-slate-500 text-xs ml-2">{paUser.email}</span>}
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 text-sm transition-colors px-3 py-1.5 hover:bg-red-500/10 rounded-lg">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-5">
        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total Gyms" value={stats.totalGyms} color="text-white" />
            <StatCard label="Active" value={stats.activeGyms} sub="gyms" color="text-emerald-400" />
            <StatCard label="Suspended" value={stats.suspendedGyms} sub="gyms" color="text-red-400" />
            <StatCard label="Total Members" value={stats.totalMembers} color="text-blue-400" />
            <StatCard label="Active Members" value={stats.activeMembers} color="text-emerald-400" />
            <StatCard label="Unused Codes" value={stats.unusedCodes} color="text-violet-400" />
            <StatCard label="Pending Apps" value={stats.pendingApplications} color={stats.pendingApplications > 0 ? "text-amber-400" : "text-slate-500"} />
          </div>
        )}

        {/* Tab nav */}
        <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
          <div className="flex gap-1 bg-slate-900 border border-white/5 rounded-2xl p-1.5 w-fit min-w-full sm:min-w-0">
            {tabs.map(({ key, label, icon: Icon, badge }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === key ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {label}
                {badge != null && badge > 0 && (
                  <span className={`absolute -top-1 -right-1 w-4 h-4 text-xs font-bold flex items-center justify-center rounded-full ${
                    tab === key ? "bg-white text-violet-700" : "bg-amber-500 text-white"
                  }`}>{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-violet-400" /> Recent Gyms
                </h3>
                <div className="space-y-3">
                  {gyms.slice(0, 6).map(g => (
                    <div key={g.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-white">{g.name}</p>
                        <p className="text-xs text-slate-500">{g.activeMembers} active · {g.plan}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${g.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {g.status}
                      </span>
                    </div>
                  ))}
                  {gyms.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No gyms yet</p>}
                </div>
              </div>

              <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-400" /> Pending Applications
                  {pendingApps.length > 0 && (
                    <span className="ml-auto text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/25">{pendingApps.length}</span>
                  )}
                </h3>
                {pendingApps.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">No pending applications</p>
                ) : (
                  <div className="space-y-3">
                    {pendingApps.slice(0, 5).map(app => (
                      <div key={app.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-white">{app.gymName}</p>
                          <p className="text-xs text-slate-500">{app.ownerName} · {app.email}</p>
                        </div>
                        <button onClick={() => { setTab("applications"); }}
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                          Review <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GYMS */}
        {tab === "gyms" && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
            {gymsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent" />
              </div>
            ) : gyms.length === 0 ? (
              <div className="py-16 text-center text-slate-500">No gyms registered yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left font-medium">Gym</th>
                      <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Plan</th>
                      <th className="px-4 py-3 text-left font-medium">Members</th>
                      <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Join Code</th>
                      <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Sub Expiry</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gyms.map(g => {
                      const limitHit = g.memberLimit !== null && g.memberCount >= g.memberLimit;
                      return (
                        <tr key={g.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                          <td className="px-5 py-4">
                            <p className="text-white font-medium">{g.name}</p>
                            <p className="text-xs text-slate-500">{g.slug}</p>
                          </td>
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <span className="text-xs bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-md capitalize">{g.plan}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-medium">{g.memberCount}</span>
                              {g.memberLimit !== null && (
                                <>
                                  <span className="text-slate-600">/</span>
                                  <span className={`text-xs ${limitHit ? "text-red-400" : "text-slate-400"}`}>{g.memberLimit}</span>
                                  {limitHit && <AlertCircle className="w-3 h-3 text-red-400" />}
                                </>
                              )}
                            </div>
                            {g.memberLimit !== null && (
                              <div className="mt-1 h-1 bg-slate-800 rounded-full w-16">
                                <div className={`h-full rounded-full transition-all ${limitHit ? "bg-red-500" : "bg-violet-500"}`}
                                  style={{ width: `${Math.min((g.memberCount / g.memberLimit) * 100, 100)}%` }} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell">
                            <span className="font-mono text-xs text-slate-400">{g.memberJoinCode ?? "—"}</span>
                          </td>
                          <td className="px-4 py-4 hidden xl:table-cell">
                            {g.subscriptionExpiry
                              ? <span className="text-xs text-slate-300">{formatDate(g.subscriptionExpiry)}</span>
                              : <span className="text-xs text-slate-600">Not set</span>}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${g.status === "active" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                              {g.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => impersonateMutation.mutate(g.id)}
                                disabled={impersonateMutation.isPending}
                                title="Access gym as owner"
                                className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { setCredsModal(g); setCredsForm({ email: "", password: "" }); setCredsSuccess(false); }}
                                title="Change login credentials"
                                className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all">
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => openEdit(g)} title="Edit gym"
                                className="p-1.5 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => { setSubModal(g); setSubForm(f => ({ ...f, startDate: new Date().toISOString().split("T")[0], endDate: addMonths(1) })); }}
                                title="Grant subscription" className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all">
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setToggleGymConfirm({ gym: g, newStatus: g.status === "active" ? "suspended" : "active" })}
                                disabled={toggleGymMutation.isPending}
                                title={g.status === "active" ? "Suspend" : "Activate"}
                                className={`p-1.5 rounded-lg transition-all ${g.status === "active" ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10"}`}>
                                {g.status === "active" ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => { setDeleteGymConfirm(g); setDeleteGymNameInput(""); }}
                                title="Delete gym permanently"
                                className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* APPLICATIONS */}
        {tab === "applications" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {["All", "Pending", "Approved", "Rejected"].map(f => {
                const count = f === "All" ? applications.length : applications.filter(a => a.status === f.toLowerCase()).length;
                return (
                  <span key={f} className="text-xs bg-slate-800 border border-white/5 text-slate-400 px-3 py-1.5 rounded-lg">
                    {f} <span className="text-white font-bold ml-1">{count}</span>
                  </span>
                );
              })}
            </div>

            {appsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-violet-500 border-t-transparent" />
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-slate-900 border border-white/5 rounded-2xl py-16 text-center">
                <Send className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No applications yet</p>
                <p className="text-slate-600 text-xs mt-1">Applications from the gym signup page will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(app => (
                  <div key={app.id} className={`bg-slate-900 border rounded-2xl p-5 ${
                    app.status === "pending" ? "border-amber-500/20" :
                    app.status === "approved" ? "border-emerald-500/20" :
                    "border-white/5"
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-bold text-white text-base">{app.gymName}</h3>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize border ${
                            app.status === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                            app.status === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" :
                            "bg-red-500/15 text-red-400 border-red-500/25"
                          }`}>{app.status}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400">
                          <span><span className="text-slate-600">Owner:</span> {app.ownerName}</span>
                          <span><span className="text-slate-600">Email:</span> {app.email}</span>
                          <span><span className="text-slate-600">Phone:</span> {app.countryCode} {app.phone}</span>
                          <span><span className="text-slate-600">Plan:</span> <span className="capitalize">{app.planRequest ?? "starter"}</span></span>
                          {app.address && <span className="sm:col-span-2"><span className="text-slate-600">Address:</span> {app.address}</span>}
                          {app.notes && <span className="sm:col-span-2"><span className="text-slate-600">Notes:</span> {app.notes}</span>}
                          {app.assignedAccessCode && (
                            <span className="sm:col-span-2">
                              <span className="text-slate-600">Access Code:</span>{" "}
                              <span className="font-mono font-bold text-emerald-400 tracking-wider">{app.assignedAccessCode}</span>
                            </span>
                          )}
                          {app.rejectionReason && (
                            <span className="sm:col-span-2"><span className="text-slate-600">Reason:</span> {app.rejectionReason}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-2">Applied {formatDate(app.createdAt)}</p>
                      </div>

                      {app.status === "pending" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => { setApproveModal(app); setApproveForm({ assignedExpiry: "", assignedMemberLimit: "" }); }}
                            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 text-xs px-3 py-1.5 rounded-xl transition-all font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectModal(app); setRejectReason(""); }}
                            className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 text-xs px-3 py-1.5 rounded-xl transition-all font-semibold">
                            <Ban className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACCESS CODES */}
        {tab === "codes" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Generate New Access Code</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input value={codeLabel} onChange={e => setCodeLabel(e.target.value)} placeholder="Label (optional, e.g. 'Trial – June')"
                  className="bg-slate-800 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
                <select value={codePlan} onChange={e => setCodePlan(e.target.value)}
                  className="bg-slate-800 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 capitalize">
                  {PLANS.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
                <input type="number" min="1" max="365" value={codeTrialDays} onChange={e => setCodeTrialDays(e.target.value)} placeholder="Trial days (default 30)"
                  className="bg-slate-800 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Plan sets the gym's feature access. Trial days is informational for now.
                </p>
                <button onClick={() => createCodeMutation.mutate()} disabled={createCodeMutation.isPending}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-500/20 flex-shrink-0">
                  <Plus className="w-4 h-4" /> Generate Code
                </button>
              </div>
            </div>
            <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
              {codesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-500 border-t-transparent" />
                </div>
              ) : codes.length === 0 ? (
                <div className="py-12 text-center text-slate-500">No access codes yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 text-left font-medium">Code</th>
                        <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Label</th>
                        <th className="px-4 py-3 text-left font-medium">Plan</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Created</th>
                        <th className="px-4 py-3 text-right w-16">Del</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map(c => (
                        <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                          <td className="px-5 py-3">
                            <span className="font-mono font-bold text-white text-base tracking-widest">{c.code}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{c.label ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-md font-semibold capitalize ${
                              c.plan === "enterprise" ? "bg-amber-500/15 text-amber-400" :
                              c.plan === "pro" ? "bg-violet-500/15 text-violet-400" :
                              "bg-slate-700 text-slate-400"
                            }`}>{c.plan ?? "basic"}</span>
                          </td>
                          <td className="px-4 py-3">
                            {c.used ? (
                              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Used</span>
                            ) : c.active ? (
                              <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">Available</span>
                            ) : (
                              <span className="text-xs bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{formatDate(c.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            {!c.used && (
                              <button onClick={() => setDeleteCodeConfirm(c)} disabled={deleteCodeMutation.isPending}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBSCRIPTIONS */}
        {tab === "subscriptions" && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
            {subscriptions.length === 0 ? (
              <div className="py-16 text-center">
                <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No subscriptions yet</p>
                <p className="text-slate-600 text-xs mt-1">Grant subscriptions to gyms via the Gyms tab</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left font-medium">Gym</th>
                      <th className="px-4 py-3 text-left font-medium">Plan</th>
                      <th className="px-4 py-3 text-left font-medium">Start</th>
                      <th className="px-4 py-3 text-left font-medium">End</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map(s => {
                      const expired = new Date(s.endDate) < new Date();
                      return (
                        <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                          <td className="px-5 py-3 font-medium text-white">{s.gymName}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-violet-500/15 text-violet-400 px-2 py-0.5 rounded-md capitalize">{s.plan}</span></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(s.startDate)}</td>
                          <td className="px-4 py-3 text-xs"><span className={expired ? "text-red-400" : "text-slate-300"}>{formatDate(s.endDate)}</span></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${expired ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                              {expired ? "Expired" : "Active"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BACKUP */}
        {tab === "backup" && (
          <div className="space-y-5">

            {/* DB Connection Banner */}
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/25">
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-emerald-400">Replit PostgreSQL — Connected</span>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  All data (gyms, members, payments, attendance, subscriptions) persists permanently in Replit's built-in PostgreSQL database. Data survives restarts and refreshes.
                </p>
              </div>
            </div>

            {/* DB Health */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-violet-400" /> Live Table Counts
                </h3>
                <button onClick={() => refetchHealth()}
                  disabled={healthLoading}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all">
                  <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
              {backupHealth ? (
                <div className="space-y-4">
                  {/* DB info row */}
                  {backupHealth.database && (
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-emerald-400 font-semibold">{backupHealth.database.provider}</span>
                      </div>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">db: <span className="text-white font-mono">{backupHealth.database.name}</span></span>
                      {backupHealth.database.version && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400">PostgreSQL <span className="text-slate-300">{backupHealth.database.version}</span></span>
                        </>
                      )}
                      <span className="text-slate-600 ml-auto">Checked {new Date(backupHealth.checkedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(backupHealth.tables).map(([name, count]) => (
                      <div key={name} className="bg-slate-800 rounded-xl p-3">
                        <p className="text-xs text-slate-500 capitalize">{name.replace(/_/g, " ")}</p>
                        <p className="text-xl font-bold text-white mt-1">{count}</p>
                        <p className="text-xs text-slate-600">rows</p>
                      </div>
                    ))}
                  </div>
                  {lastExportTime && (
                    <p className="text-xs text-slate-500 pt-1">Last export: <span className="text-slate-400">{lastExportTime}</span></p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-slate-600 text-sm gap-2">
                  {healthLoading
                    ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-violet-500 border-t-transparent" /> Checking…</>
                    : "Click Refresh to check live row counts"
                  }
                </div>
              )}
            </div>

            {/* Full Backup Export */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-emerald-400" /> Export Backup
              </h3>
              <p className="text-xs text-slate-500 mb-4">Download a complete JSON backup of all platform data.</p>
              <button onClick={handleExportFull} disabled={exportLoading === "full"}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20">
                {exportLoading === "full"
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Exporting…</>
                  : <><Download className="w-4 h-4" /> Download Full Backup (JSON)</>
                }
              </button>

              <div className="mt-5 pt-5 border-t border-white/5">
                <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">Export Individual Tables</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {TABLE_EXPORTS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                      <span className="text-sm text-slate-300 font-medium">{label}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleExportTable(key, "csv")}
                          disabled={!!exportLoading}
                          className="text-xs bg-white/5 hover:bg-violet-500/15 text-slate-400 hover:text-violet-300 border border-white/8 hover:border-violet-500/25 px-2.5 py-1 rounded-lg transition-all font-mono">
                          CSV
                        </button>
                        <button onClick={() => handleExportTable(key, "json")}
                          disabled={!!exportLoading}
                          className="text-xs bg-white/5 hover:bg-violet-500/15 text-slate-400 hover:text-violet-300 border border-white/8 hover:border-violet-500/25 px-2.5 py-1 rounded-lg transition-all font-mono">
                          JSON
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Import / Restore */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-amber-400" /> Import / Restore
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Upload a JSON backup file. Duplicate records are skipped automatically. Existing data is never overwritten.
              </p>

              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Only JSON files exported from GymFlow are supported. Members with a missing gym ID will be skipped.
              </div>

              <input ref={fileInputRef} type="file" accept=".json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={importLoading}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all">
                {importLoading
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Importing…</>
                  : <><Upload className="w-4 h-4" /> Choose Backup File (.json)</>
                }
              </button>

              {importError && (
                <div className="mt-4 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {importError}
                </div>
              )}

              {importResult && (
                <div className={`mt-4 rounded-xl border p-4 ${importResult.success ? "bg-emerald-500/8 border-emerald-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
                  <p className={`text-sm font-semibold mb-3 ${importResult.success ? "text-emerald-400" : "text-amber-400"}`}>
                    {importResult.success ? "Import completed successfully" : "Import completed with some errors"}
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-emerald-400">{importResult.totalInserted}</p>
                      <p className="text-xs text-slate-500">Inserted</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold text-slate-400">{importResult.totalSkipped}</p>
                      <p className="text-xs text-slate-500">Skipped</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2.5 text-center">
                      <p className={`text-lg font-bold ${importResult.totalErrors > 0 ? "text-red-400" : "text-slate-600"}`}>{importResult.totalErrors}</p>
                      <p className="text-xs text-slate-500">Errors</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(importResult.summary).map(([table, r]) => (
                      <div key={table} className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500 capitalize w-28 flex-shrink-0">{table.replace(/_/g, " ")}</span>
                        <span className="text-emerald-400">+{r.inserted}</span>
                        {r.skipped > 0 && <span className="text-slate-500">skipped {r.skipped}</span>}
                        {r.errors.length > 0 && <span className="text-red-400">{r.errors.length} error(s): {r.errors[0]}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ── MODALS ── */}

      {/* Edit Gym Modal */}
      {editGym && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold text-white">Edit — {editGym.name}</h3>
              <button onClick={() => setEditGym(null)} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Plan</label>
                <select value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))} className={inputCls}>
                  {PLANS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Member Limit <span className="normal-case text-slate-600">(empty = unlimited)</span></label>
                <input type="number" value={editForm.memberLimit} onChange={e => setEditForm(f => ({ ...f, memberLimit: e.target.value }))} placeholder="e.g. 100" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Subscription Expiry</label>
                <input type="date" value={editForm.subscriptionExpiry} onChange={e => setEditForm(f => ({ ...f, subscriptionExpiry: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditGym(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">Cancel</button>
                <button onClick={() => updateGymMutation.mutate({ id: editGym.id, data: editForm })} disabled={updateGymMutation.isPending}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                  {updateGymMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {subModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold text-white">Grant Subscription — {subModal.name}</h3>
              <button onClick={() => setSubModal(null)} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Plan</label>
                <select value={subForm.plan} onChange={e => setSubForm(f => ({ ...f, plan: e.target.value }))} className={inputCls}>
                  {PLANS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                  <input type="date" value={subForm.startDate} onChange={e => setSubForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">End Date</label>
                  <input type="date" value={subForm.endDate} onChange={e => setSubForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {SUB_DURATIONS.map(d => (
                  <button key={d.label} onClick={() => setSubForm(f => ({ ...f, endDate: addMonths(d.months) }))}
                    className="text-xs bg-white/5 hover:bg-violet-500/15 text-slate-400 hover:text-violet-400 border border-white/5 hover:border-violet-500/25 px-3 py-1.5 rounded-lg transition-all">
                    {d.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Notes</label>
                <input type="text" value={subForm.notes} onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note" className={inputCls} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSubModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">Cancel</button>
                <button onClick={() => createSubMutation.mutate(subModal.id)} disabled={createSubMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                  {createSubMutation.isPending ? "Granting..." : "Grant Subscription"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Application Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h3 className="font-bold text-white">Approve Application</h3>
                <p className="text-xs text-slate-400 mt-0.5">{approveModal.gymName} — {approveModal.ownerName}</p>
              </div>
              <button onClick={() => setApproveModal(null)} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400">
                Approving will automatically generate an access code for this gym.
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Subscription Expiry <span className="normal-case text-slate-600">(optional)</span></label>
                <input type="date" value={approveForm.assignedExpiry} onChange={e => setApproveForm(f => ({ ...f, assignedExpiry: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Member Limit <span className="normal-case text-slate-600">(empty = unlimited)</span></label>
                <input type="number" value={approveForm.assignedMemberLimit} onChange={e => setApproveForm(f => ({ ...f, assignedMemberLimit: e.target.value }))} placeholder="e.g. 100" className={inputCls} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setApproveModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">Cancel</button>
                <button onClick={() => approveAppMutation.mutate({ id: approveModal.id, data: approveForm })} disabled={approveAppMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                  {approveAppMutation.isPending ? "Approving..." : "Approve & Generate Code"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Credentials Modal */}
      {credsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" /> Change Login — {credsModal.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Update the gym owner's email or password</p>
              </div>
              <button onClick={() => setCredsModal(null)} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {credsSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-14 h-14 bg-emerald-500/15 rounded-full flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Credentials updated!</p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400">
                    Leave a field blank to keep it unchanged. Only filled fields will be updated.
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">New Email</label>
                    <input type="email" value={credsForm.email} onChange={e => setCredsForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="Leave blank to keep current" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">New Password</label>
                    <input type="password" value={credsForm.password} onChange={e => setCredsForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Leave blank to keep current" className={inputCls} />
                  </div>
                  {credsMutation.error && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">
                      {(credsMutation.error as Error).message}
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setCredsModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">Cancel</button>
                    <button
                      onClick={() => {
                        if (!credsForm.email && !credsForm.password) return;
                        credsMutation.mutate({ gymId: credsModal.id, data: credsForm });
                      }}
                      disabled={credsMutation.isPending || (!credsForm.email && !credsForm.password)}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                      {credsMutation.isPending ? "Updating..." : "Update Credentials"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Application Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h3 className="font-bold text-white">Reject Application</h3>
                <p className="text-xs text-slate-400 mt-0.5">{rejectModal.gymName} — {rejectModal.ownerName}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Reason for Rejection <span className="normal-case text-slate-600">(optional)</span></label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                  className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 text-sm resize-none"
                  placeholder="e.g. Incomplete information, duplicate application..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setRejectModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">Cancel</button>
                <button onClick={() => rejectAppMutation.mutate({ id: rejectModal.id, reason: rejectReason })} disabled={rejectAppMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                  {rejectAppMutation.isPending ? "Rejecting..." : "Reject Application"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Access Code */}
      {deleteCodeConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-500/20 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto border border-red-500/25">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Access Code?</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Code <span className="font-mono font-bold text-white">{deleteCodeConfirm.code}</span> will be permanently deleted.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDeleteCodeConfirm(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">
                  Cancel
                </button>
                <button onClick={() => deleteCodeMutation.mutate(deleteCodeConfirm.id)} disabled={deleteCodeMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                  {deleteCodeMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Gym */}
      {deleteGymConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center border border-red-500/30 flex-shrink-0">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Delete Gym Permanently</h3>
                  <p className="text-xs text-slate-500 mt-0.5">This cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 space-y-1">
                <p className="font-semibold">This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-400/80">
                  <li>All members ({deleteGymConfirm.memberCount})</li>
                  <li>All payments & attendance records</li>
                  <li>All workout plans & subscriptions</li>
                  <li>All staff accounts & gym settings</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Type <span className="font-mono font-bold text-white">{deleteGymConfirm.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteGymNameInput}
                  onChange={e => setDeleteGymNameInput(e.target.value)}
                  placeholder={deleteGymConfirm.name}
                  className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-red-500/50"
                  autoFocus
                />
              </div>

              {deleteGymMutation.error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {(deleteGymMutation.error as Error).message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteGymConfirm(null); setDeleteGymNameInput(""); }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => deleteGymMutation.mutate(deleteGymConfirm.id)}
                  disabled={deleteGymNameInput !== deleteGymConfirm.name || deleteGymMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition-all">
                  {deleteGymMutation.isPending ? "Deleting..." : "Delete Forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Toggle Gym Status */}
      {toggleGymConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-slate-900 border rounded-2xl w-full max-w-sm shadow-2xl ${toggleGymConfirm.newStatus === "suspended" ? "border-red-500/20" : "border-emerald-500/20"}`}>
            <div className="p-6 text-center space-y-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${toggleGymConfirm.newStatus === "suspended" ? "bg-red-500/15 border-red-500/25" : "bg-emerald-500/15 border-emerald-500/25"}`}>
                {toggleGymConfirm.newStatus === "suspended"
                  ? <Ban className="w-6 h-6 text-red-400" />
                  : <CheckCircle className="w-6 h-6 text-emerald-400" />
                }
              </div>
              <div>
                <h3 className="font-bold text-white text-base capitalize">{toggleGymConfirm.newStatus === "suspended" ? "Suspend" : "Activate"} Gym?</h3>
                <p className="text-slate-400 text-sm mt-1">
                  <span className="text-white font-medium">{toggleGymConfirm.gym.name}</span> will be{" "}
                  {toggleGymConfirm.newStatus === "suspended"
                    ? "suspended — all logins will be blocked."
                    : "reactivated — logins will be restored."
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setToggleGymConfirm(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => toggleGymMutation.mutate({ id: toggleGymConfirm.gym.id, status: toggleGymConfirm.newStatus })}
                  disabled={toggleGymMutation.isPending}
                  className={`flex-1 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all ${toggleGymConfirm.newStatus === "suspended" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                  {toggleGymMutation.isPending ? "Updating..." : toggleGymConfirm.newStatus === "suspended" ? "Suspend" : "Activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
