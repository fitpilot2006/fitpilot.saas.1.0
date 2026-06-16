import { Link, useLocation } from "wouter";
import { clearAuth, getUser, getImpersonating, clearImpersonating } from "../lib/auth.js";
import {
  LayoutDashboard, Users, Calendar, CreditCard, Dumbbell, Palette,
  LogOut, Menu, X, Bell, Zap,
  AlertTriangle, CheckCircle, Shield, Brain, Salad,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/attendance", label: "Attendance", icon: Calendar },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/workout-plans", label: "Workout Plans", icon: Dumbbell },
  { href: "/staff", label: "Staff Panel", icon: Zap },
  { href: "/branding", label: "Branding Studio", icon: Palette },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/ai-workout", label: "AI Workout", icon: Brain },
  { href: "/ai-diet", label: "AI Diet Planner", icon: Salad },
];

interface DashboardStats { pendingPayments: number; expiredMembers: number; }
interface Branding {
  gymName: string; logoUrl: string | null; bannerUrl: string | null;
  thumbnailUrl: string | null; primaryColor: string; sidebarColor: string | null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const user = getUser();
  const impersonatingGym = getImpersonating();

  function exitAdminView() {
    clearImpersonating();
    clearAuth();
    window.location.href = "/platform-admin/dashboard";
  }

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/dashboard/stats"),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: branding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api.get("/branding"),
    staleTime: 300_000,
  });

  const alertCount = (stats?.expiredMembers ?? 0) + (stats?.pendingPayments ? 1 : 0);
  const primary = branding?.primaryColor ?? "#dc2626";
  const sidebarBg = branding?.sidebarColor ?? "#0a0005";
  const mainBg = branding?.secondaryColor ?? "#0d0005";
  const gymName = branding?.gymName ?? "My Gym";

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--gym-primary", primary);
    root.style.setProperty("--gym-sidebar", sidebarBg);
    root.style.setProperty("--gym-main-bg", mainBg);
    // Derived vars (used by buttons, cards, inputs)
    root.style.setProperty("--gym-primary-20", `${primary}33`);
    root.style.setProperty("--gym-primary-10", `${primary}1a`);
    root.style.setProperty("--gym-card-bg", "rgba(255,255,255,0.04)");
    root.style.setProperty("--gym-border", "rgba(255,255,255,0.07)");
    root.style.setProperty("--gym-input-bg", "rgba(255,255,255,0.05)");
  }, [primary, sidebarBg, mainBg]);

  function handleLogout() {
    clearAuth();
    window.location.href = "/login";
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: sidebarBg }}>
      {/* Gym Header — shows banner as background if available */}
      <div className="relative border-b border-white/5 overflow-hidden">
        {branding?.bannerUrl && (
          <>
            <img
              src={branding.bannerUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/75 to-black/90" />
          </>
        )}

        <div className="relative z-10 px-4 py-5">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={gymName}
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-lg"
                style={{ boxShadow: `0 4px 14px ${primary}40` }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: primary, boxShadow: `0 4px 14px ${primary}50` }}
              >
                <Dumbbell className="text-white w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate leading-tight">{gymName}</p>
              <p className="text-xs text-white/40 mt-0.5">Management Portal</p>
            </div>
          </div>

          {user && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/10 border border-white/8 flex items-center gap-2.5">
              {branding?.thumbnailUrl ? (
                <img
                  src={branding.thumbnailUrl}
                  alt="Gym"
                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                  style={{ boxShadow: `0 2px 8px ${primary}40` }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                  style={{ background: `${primary}40` }}>
                  {(gymName[0] ?? "G").toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-white/50 truncate leading-tight">{user.email}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <p className="text-xs font-medium capitalize" style={{ color: primary }}>
                    {user.role?.replace("_", " ") ?? "staff"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-none">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/dashboard" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active ? "text-white shadow-lg" : "text-white/40 hover:bg-white/5 hover:text-white/80"
              }`}
              style={active ? { background: `${primary}22`, color: "white" } : {}}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                  active ? "" : "bg-white/5 group-hover:bg-white/10"
                }`}
                style={active ? { background: primary, boxShadow: `0 4px 10px ${primary}40` } : {}}
              >
                <Icon className="w-3.5 h-3.5" style={active ? { color: "white" } : {}} />
              </div>
              <span className="flex-1 truncate">{label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Alerts + Logout */}
      <div className="px-3 py-4 border-t border-white/5 space-y-2">
        {stats && (stats.expiredMembers > 0 || stats.pendingPayments > 0) && (
          <div className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-xs text-amber-400 font-semibold">Alerts</p>
            </div>
            {stats.expiredMembers > 0 && (
              <p className="text-xs text-white/40">{stats.expiredMembers} expired memberships</p>
            )}
            {stats.pendingPayments > 0 && (
              <p className="text-xs text-white/40">Outstanding payments pending</p>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all w-full group"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-red-500/15 flex items-center justify-center flex-shrink-0 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </div>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: mainBg }}>
      {/* Admin Impersonation Banner */}
      {impersonatingGym && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-violet-600 z-50">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-semibold">
              Admin View: <span className="font-bold">{impersonatingGym}</span>
            </span>
            <span className="text-violet-200 text-xs">— viewing as gym owner</span>
          </div>
          <button
            onClick={exitAdminView}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
          >
            <X className="w-3.5 h-3.5" /> Exit Admin View
          </button>
        </div>
      )}
    <div className="flex flex-1 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-white/5">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/85" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 z-10 text-white/40 hover:text-white bg-white/5 rounded-lg p-1.5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 bg-slate-900 lg:bg-slate-900/70 lg:backdrop-blur-xl border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-white/40 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt={gymName} className="w-6 h-6 rounded-lg object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: primary }}>
                  <Dumbbell className="text-white w-3.5 h-3.5" />
                </div>
              )}
              <span className="font-bold text-white text-sm truncate max-w-32">{gymName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Alerts</p>
                    <button onClick={() => setNotifOpen(false)} className="text-white/30 hover:text-white p-1 rounded-lg transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                    {stats && stats.expiredMembers > 0 && (
                      <div className="flex gap-2.5 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-white font-medium">{stats.expiredMembers} expired memberships</p>
                          <p className="text-xs text-white/40 mt-0.5">Renew to keep members active</p>
                        </div>
                      </div>
                    )}
                    {stats && stats.pendingPayments > 0 && (
                      <div className="flex gap-2.5 p-2.5 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                        <CreditCard className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-white font-medium">Payments awaiting collection</p>
                          <p className="text-xs text-white/40 mt-0.5">Review the payments page</p>
                        </div>
                      </div>
                    )}
                    {(!stats || (stats.expiredMembers === 0 && stats.pendingPayments === 0)) && (
                      <div className="flex flex-col items-center py-6 text-center gap-2">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                        <p className="text-xs text-white/40">All clear — no alerts!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 flex flex-col">
          <div className="min-w-0 w-full flex-1">
            {children}
          </div>
          <footer className="mt-8 pt-4 border-t border-white/5 flex items-center justify-center gap-4 text-xs text-white/20">
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
            <span>·</span>
            <span>© 2026 FitPilot. All rights reserved.</span>
          </footer>
        </main>
      </div>
    </div>
    </div>
  );
}
