import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserCheck, TrendingUp, Calendar, CreditCard, Dumbbell,
  AlertTriangle, Activity, ArrowUpRight, Copy, CheckCheck, RefreshCw,
  UserPlus, QrCode, Zap, Clock, Image,
} from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { api } from "../lib/api.js";
import { formatCurrency, formatDate, daysUntil } from "../lib/utils.js";
import { useState } from "react";

interface Branding {
  gymName: string; tagline: string | null; logoUrl: string | null;
  bannerUrl: string | null; thumbnailUrl: string | null;
  primaryColor: string; sidebarColor: string | null;
}

interface DashboardStats {
  totalMembers: number; activeMembers: number; expiredMembers: number;
  todayAttendance: number; monthlyRevenue: number; pendingPayments: number;
  totalWorkoutPlans: number; newMembersThisMonth: number; memberJoinCode?: string;
}
interface Member { id: number; name: string; email: string; membershipExpiry: string; membershipType: string; }
interface RecentCheckin { id: number; memberId: number; memberName: string; checkInAt: string; }
interface DataPoint { date: string; count: number; }
interface RevenuePoint { month: string; revenue: number; }

type StatColor = "orange" | "green" | "blue" | "purple" | "red" | "yellow";

const COLOR_MAP: Record<StatColor, { bg: string; text: string; border: string; glow: string }> = {
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", glow: "#f97316" },
  green:  { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", glow: "#10b981" },
  blue:   { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", glow: "#3b82f6" },
  purple: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20", glow: "#8b5cf6" },
  red:    { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", glow: "#ef4444" },
  yellow: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", glow: "#f59e0b" },
};

function StatCard({ icon: Icon, label, value, sub, color = "orange", trend }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: StatColor; trend?: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`relative bg-slate-800 border ${c.border} rounded-2xl p-5 transition-all duration-200 group overflow-hidden`}>
      <div className="absolute inset-x-0 -top-px h-px opacity-50"
        style={{ background: `linear-gradient(90deg, transparent, ${c.glow}80, transparent)` }} />
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
        style={{ background: c.glow }} />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-bold text-white mt-1.5 tabular-nums leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1.5 truncate">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${c.bg} flex-shrink-0 transition-transform group-hover:scale-110 duration-200`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
      {trend && (
        <div className={`mt-3 pt-3 border-t border-white/5 flex items-center gap-1 text-xs ${c.text}`}>
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 shadow-xl">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-bold text-white mt-0.5">
          {typeof payload[0].value === "number" && payload[0].value > 100
            ? `$${payload[0].value.toLocaleString()}`
            : payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-orange-500", "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500"];
  return (
    <div className={`w-7 h-7 ${colors[name.charCodeAt(0) % colors.length]} rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: branding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api.get("/branding"),
    staleTime: 300_000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats"),
    refetchInterval: 30_000,
  });
  const { data: expiring } = useQuery<Member[]>({
    queryKey: ["expiring-memberships"],
    queryFn: () => api.get("/dashboard/expiring-memberships"),
    refetchInterval: 60_000,
  });
  const { data: attendance } = useQuery<DataPoint[]>({
    queryKey: ["attendance-chart"],
    queryFn: () => api.get("/dashboard/attendance-chart"),
    refetchInterval: 60_000,
  });
  const { data: revenue } = useQuery<RevenuePoint[]>({
    queryKey: ["revenue-chart"],
    queryFn: () => api.get("/dashboard/revenue-chart"),
    refetchInterval: 60_000,
  });
  const { data: recentCheckins = [] } = useQuery<RecentCheckin[]>({
    queryKey: ["recent-checkins"],
    queryFn: () => api.get("/dashboard/recent-checkins"),
    refetchInterval: 30_000,
  });

  function copyCode() {
    if (stats?.memberJoinCode) {
      navigator.clipboard.writeText(stats.memberJoinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      qc.invalidateQueries({ queryKey: ["expiring-memberships"] }),
      qc.invalidateQueries({ queryKey: ["attendance-chart"] }),
      qc.invalidateQueries({ queryKey: ["revenue-chart"] }),
      qc.invalidateQueries({ queryKey: ["recent-checkins"] }),
    ]);
    setTimeout(() => setRefreshing(false), 800);
  }

  if (statsLoading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="skeleton h-8 w-48 rounded-xl" />
          <div className="skeleton h-8 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const chartAttendance = attendance?.map(a => ({
    name: new Date(a.date).toLocaleDateString("en", { weekday: "short" }),
    value: a.count,
  })) ?? [];

  const chartRevenue = revenue?.map(r => ({ name: r.month, value: r.revenue })) ?? [];

  const attendanceRate = stats?.totalMembers
    ? Math.round((stats.todayAttendance / stats.totalMembers) * 100)
    : 0;

  const quickActions = [
    { label: "Add Member", sub: "Register new", icon: UserPlus, href: "/members", color: "blue" },
    { label: "Payments", sub: "Record & track", icon: CreditCard, href: "/payments", color: "purple" },
    { label: "QR Scanner", sub: "Check-in", icon: QrCode, href: "/staff", color: "orange" },
    { label: "Workouts", sub: "Manage plans", icon: Dumbbell, href: "/workout-plans", color: "green" },
  ] as const;

  const primary = branding?.primaryColor ?? "#dc2626";

  return (
    <div className="space-y-5 fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {branding?.thumbnailUrl ? (
            <div className="relative flex-shrink-0">
              <img
                src={branding.thumbnailUrl}
                alt="Gym"
                className="w-12 h-12 rounded-2xl object-cover shadow-lg"
                style={{ boxShadow: `0 4px 16px ${primary}40` }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
            </div>
          ) : branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Gym" className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
              style={{ boxShadow: `0 4px 14px ${primary}40` }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{branding?.gymName ?? "Dashboard"}</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <button onClick={handleRefresh}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all flex-shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Member Join Code Banner */}
      {stats?.memberJoinCode && (
        <div className="relative overflow-hidden rounded-2xl p-4 border"
          style={{ background: `linear-gradient(to right, ${primary}18, ${primary}08, transparent)`, borderColor: `${primary}30` }}>
          <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
            style={{ background: `linear-gradient(to bottom, ${primary}, ${primary}99)` }} />
          <div className="flex items-center justify-between gap-4 pl-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: primary }}>Member Join Code</p>
              <p className="text-2xl font-bold text-white font-mono mt-0.5 tracking-[0.3em]">{stats.memberJoinCode}</p>
              <p className="text-xs text-slate-400 mt-0.5">Share with new members to join your gym</p>
            </div>
            <button onClick={copyCode}
              className="flex items-center gap-2 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all flex-shrink-0"
              style={{ background: primary, boxShadow: `0 4px 16px ${primary}40` }}
              onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}>
              {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Members" value={stats?.totalMembers ?? 0} color="blue"
          sub={`${stats?.newMembersThisMonth ?? 0} joined this month`} />
        <StatCard icon={UserCheck} label="Active Members" value={stats?.activeMembers ?? 0} color="green"
          trend={stats?.newMembersThisMonth ? `+${stats.newMembersThisMonth} this month` : undefined} />
        <StatCard icon={Calendar} label="Today's Check-ins" value={stats?.todayAttendance ?? 0} color="orange"
          sub={`${attendanceRate}% attendance rate`} />
        <StatCard icon={TrendingUp} label="Monthly Revenue" value={formatCurrency(stats?.monthlyRevenue ?? 0)} color="purple"
          trend="Paid payments this month" />
        <StatCard icon={AlertTriangle} label="Expired Members" value={stats?.expiredMembers ?? 0} color="red"
          sub="Need renewal" />
        <StatCard icon={Dumbbell} label="Workout Plans" value={stats?.totalWorkoutPlans ?? 0} color="blue"
          sub="Active programs" />
        <StatCard icon={Activity} label="Attendance Rate" value={`${attendanceRate}%`} color="green"
          sub="Today vs total" />
        <StatCard icon={UserPlus} label="New This Month" value={stats?.newMembersThisMonth ?? 0} color="orange"
          sub="Recent joins" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(({ label, sub, icon: Icon, href, color }) => {
          const c = COLOR_MAP[color];
          return (
            <Link key={href} href={href}>
              <div className={`flex items-center gap-3 ${c.bg} border ${c.border} rounded-2xl p-4 cursor-pointer transition-colors active:scale-[0.98] active:opacity-80`}>
                <div className={`w-9 h-9 bg-black/20 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4.5 h-4.5 ${c.text}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{label}</p>
                  <p className="text-xs text-slate-500 truncate">{sub}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance Chart */}
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-5 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">Attendance — Last 7 Days</h2>
              <p className="text-xs text-slate-500 mt-0.5">Daily check-in count</p>
            </div>
            <div className="p-2 rounded-xl flex-shrink-0" style={{ background: "var(--gym-primary-10)" }}>
              <Activity className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
            </div>
          </div>
          {chartAttendance.length > 0 ? (
            <div className="chart-wrap" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartAttendance} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" stroke={primary} strokeWidth={2.5}
                    fill="url(#attendGrad)" isAnimationActive={false}
                    dot={{ fill: primary, r: 3.5, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: primary, strokeWidth: 2, stroke: "#0f172a" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-slate-600">
              <Activity className="w-8 h-8 text-slate-700" />
              <p className="text-sm">No attendance data yet</p>
            </div>
          )}
        </div>

        {/* Revenue Chart */}
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-5 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">Revenue — Last 6 Months</h2>
              <p className="text-xs text-slate-500 mt-0.5">All payments this month</p>
            </div>
            <div className="p-2 bg-violet-500/10 rounded-xl flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-violet-400" />
            </div>
          </div>
          {chartRevenue.length > 0 ? (
            <div className="chart-wrap" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.65} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="url(#revGrad)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-slate-600">
              <TrendingUp className="w-8 h-8 text-slate-700" />
              <p className="text-sm">No revenue data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Expiring Memberships */}
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Expiring in 7 Days</h2>
            {expiring && expiring.length > 0 && (
              <span className="ml-auto text-xs bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/25">
                {expiring.length}
              </span>
            )}
          </div>
          {expiring && expiring.length > 0 ? (
            <div className="space-y-1">
              {expiring.slice(0, 6).map(m => {
                const days = daysUntil(m.membershipExpiry);
                const isUrgent = days <= 2;
                return (
                  <div key={m.id}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${
                      isUrgent ? "bg-red-500/8 border border-red-500/15" : "bg-amber-500/6 border border-amber-500/12"
                    }`}>
                    <div>
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{m.membershipType}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isUrgent ? "text-red-400" : "text-amber-400"}`}>
                        {days <= 0 ? "Today!" : `${days}d`}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(m.membershipExpiry)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <CheckCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm text-slate-400">No memberships expiring soon</p>
            </div>
          )}
        </div>

        {/* Membership Breakdown */}
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-5">Membership Breakdown</h2>
          <div className="space-y-4">
            {[
              { label: "Active", value: stats?.activeMembers ?? 0, total: stats?.totalMembers ?? 1, color: "#10b981", bg: "bg-emerald-500" },
              { label: "Expired", value: stats?.expiredMembers ?? 0, total: stats?.totalMembers ?? 1, color: "#ef4444", bg: "bg-red-500" },
              { label: "New This Month", value: stats?.newMembersThisMonth ?? 0, total: stats?.totalMembers ?? 1, color: "#3b82f6", bg: "bg-blue-500" },
            ].map(({ label, value, total, color, bg }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs font-bold text-white tabular-nums">{value}</span>
                </div>
                <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bg} rounded-full transition-all duration-700`}
                    style={{ width: `${total > 0 ? Math.min((value / total) * 100, 100) : 0}%`, boxShadow: `0 0 8px ${color}60` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-0.5">Revenue This Month</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(stats?.monthlyRevenue ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-blue-500/10 rounded-lg">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          </div>
          {recentCheckins.length > 0 ? (
            <div className="space-y-1.5">
              {recentCheckins.map(c => {
                const time = new Date(c.checkInAt);
                const now = new Date();
                const diffMs = now.getTime() - time.getTime();
                const diffMin = Math.floor(diffMs / 60000);
                const timeStr = diffMin < 1 ? "just now" :
                  diffMin < 60 ? `${diffMin}m ago` :
                  diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago` :
                  `${Math.floor(diffMin / 1440)}d ago`;
                return (
                  <div key={c.id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                    <Avatar name={c.memberName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{c.memberName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Zap className="w-2.5 h-2.5 text-emerald-400" />
                        <p className="text-xs text-slate-500">Checked in</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-600 flex-shrink-0">{timeStr}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Clock className="w-8 h-8 text-slate-700" />
              <p className="text-sm text-slate-500">No recent check-ins</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
