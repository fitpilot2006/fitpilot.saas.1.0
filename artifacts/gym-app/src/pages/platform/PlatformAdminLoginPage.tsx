import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Eye, EyeOff } from "lucide-react";
import { setPaAuth } from "../../lib/auth.js";
import { api } from "../../lib/api.js";

export default function PlatformAdminLoginPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; admin: any }>("/platform-admin/auth/login", { email, password }, true);
      setPaAuth(res.token, res.admin);
      navigate("/platform-admin/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[600px] h-[600px] bg-violet-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-60 -right-60 w-[600px] h-[600px] bg-violet-800/15 rounded-full blur-3xl" />
      </div>
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="w-full max-w-sm relative z-10">
        {/* FitPilot brand + Icon */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <img src="/fitpilot-logo.png" alt="FitPilot" className="h-12 w-auto mb-1 opacity-70" />
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-violet-600/40 ring-1 ring-violet-500/30">
            <Shield className="text-white w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-white tracking-tight">Platform Admin</h1>
            <p className="text-xs text-white/25 font-medium tracking-widest uppercase mt-1">Restricted Access</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-white/10 shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Admin Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 text-sm transition-colors"
                placeholder="admin@platform.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Password</label>
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
              className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-all shadow-xl shadow-violet-600/25 active:scale-[0.98] mt-1">
              {loading ? "Authenticating..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/15">
          This portal is for authorized platform administrators only
        </p>
      </div>
    </div>
  );
}
