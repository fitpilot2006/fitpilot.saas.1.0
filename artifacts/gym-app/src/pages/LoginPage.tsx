import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, ChevronRight, Building2, User, ArrowLeft } from "lucide-react";
import { setAuth } from "../lib/auth.js";
import { api } from "../lib/api.js";

type Mode = "choose" | "owner-login" | "member-login" | "choose-signup";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/auth/login", { email, password });
      setAuth(res.token, res.user);
      if (res.user.role === "member") navigate("/member-portal");
      else navigate("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-red-500/60 text-sm transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-red-900/20 rounded-full blur-3xl mobile-hide-glow" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-red-800/15 rounded-full blur-3xl mobile-hide-glow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/5 rounded-full blur-2xl mobile-hide-glow" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center mb-10">
          <img src="/fitpilot-logo.png" alt="FitPilot" className="h-20 w-auto" />
        </div>

        {/* CHOOSE MODE */}
        {mode === "choose" && (
          <div className="space-y-4">
            <div className="text-center mb-7">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <p className="text-white/40 text-sm mt-1.5">Choose how you want to sign in</p>
            </div>

            <button onClick={() => setMode("owner-login")}
              className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-red-500/40 rounded-2xl p-5 transition-all group text-left">
              <div className="w-12 h-12 bg-red-500/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/25 transition-colors">
                <Building2 className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">Gym Owner / Staff</p>
                <p className="text-xs text-white/35 mt-0.5">Manage your gym, members & finances</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-red-400 transition-colors" />
            </button>

            <button onClick={() => setMode("member-login")}
              className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-violet-500/40 rounded-2xl p-5 transition-all group text-left">
              <div className="w-12 h-12 bg-violet-500/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/25 transition-colors">
                <User className="w-6 h-6 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-white">Gym Member</p>
                <p className="text-xs text-white/35 mt-0.5">View membership, QR code & workouts</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-violet-400 transition-colors" />
            </button>

            <p className="pt-2 text-center text-sm text-white/30">
              New here?{" "}
              <button onClick={() => setMode("choose-signup")} className="text-red-400 hover:text-red-300 font-semibold transition-colors">
                Create an account
              </button>
            </p>
          </div>
        )}

        {/* OWNER LOGIN */}
        {mode === "owner-login" && (
          <div className="bg-slate-800 rounded-2xl p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-7">
              <button onClick={() => { setMode("choose"); setError(""); }}
                className="text-white/30 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white">Gym Owner Sign In</h2>
                <p className="text-xs text-white/35 mt-0.5">Access your management dashboard</p>
              </div>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className={inputCls} placeholder="owner@gym.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                    className={`${inputCls} pr-10`} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-all shadow-xl shadow-red-600/25 active:scale-[0.98] mt-1">
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="mt-5 text-center text-xs text-white/25">
              No account? <Link href="/signup/gym" className="text-red-400 hover:text-red-300 font-medium transition-colors">Register your gym</Link>
            </p>
          </div>
        )}

        {/* MEMBER LOGIN */}
        {mode === "member-login" && (
          <div className="bg-slate-800 rounded-2xl p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-7">
              <button onClick={() => { setMode("choose"); setError(""); }}
                className="text-white/30 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white">Member Sign In</h2>
                <p className="text-xs text-white/35 mt-0.5">Access your membership portal</p>
              </div>
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 text-sm transition-colors"
                  placeholder="member@gym.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 text-sm transition-colors"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-all shadow-xl shadow-violet-600/20 active:scale-[0.98] mt-1">
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="mt-5 text-center text-xs text-white/25">
              Not a member? <Link href="/signup/member" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">Join with a code</Link>
            </p>
          </div>
        )}

        {/* CHOOSE SIGNUP */}
        {mode === "choose-signup" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-7">
              <button onClick={() => setMode("choose")}
                className="text-white/30 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-white">Create an account</h2>
                <p className="text-white/35 text-sm mt-0.5">Choose your account type</p>
              </div>
            </div>

            <Link href="/signup/gym">
              <div className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-red-500/40 rounded-2xl p-5 transition-all group cursor-pointer">
                <div className="w-12 h-12 bg-red-500/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/25 transition-colors">
                  <Building2 className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Register a Gym</p>
                  <p className="text-xs text-white/35 mt-0.5">Requires an access code from platform admin</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-red-400 transition-colors" />
              </div>
            </Link>

            <Link href="/signup/member">
              <div className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-white/10 hover:border-violet-500/40 rounded-2xl p-5 transition-all group cursor-pointer">
                <div className="w-12 h-12 bg-violet-500/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/25 transition-colors">
                  <User className="w-6 h-6 text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">Join as Member</p>
                  <p className="text-xs text-white/35 mt-0.5">Use your gym's join code to sign up</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-violet-400 transition-colors" />
              </div>
            </Link>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-white/15">Powered by FitPilot</p>
        </div>
      </div>
    </div>
  );
}
