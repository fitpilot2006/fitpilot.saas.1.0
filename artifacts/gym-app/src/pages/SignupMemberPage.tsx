import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { setAuth } from "../lib/auth.js";
import { api } from "../lib/api.js";

const COUNTRY_CODES = [
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+81", label: "🇯🇵 +81" },
  { code: "+55", label: "🇧🇷 +55" },
  { code: "+20", label: "🇪🇬 +20" },
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+27", label: "🇿🇦 +27" },
];

export default function SignupMemberPage() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: "", email: "", password: "", joinCode: "",
    phone: "", countryCode: "+1",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.phone.trim()) {
      setError("Phone number is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        joinCode: form.joinCode,
        phone: `${form.countryCode} ${form.phone}`.trim(),
      };
      const res = await api.post<{ token: string; user: any }>("/auth/signup/member", payload);
      setAuth(res.token, res.user);
      navigate("/member-portal");
    } catch (err: any) {
      setError(err.message ?? "Signup failed");
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

        <div className="relative bg-slate-800 border border-white/8 rounded-3xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Join your gym</h2>
            <p className="text-sm text-white/40 mt-1">Enter your gym's join code to sign up as a member</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Join Code */}
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Gym Join Code
              </label>
              <input
                type="text"
                value={form.joinCode}
                onChange={set("joinCode")}
                required
                className={inputCls}
                placeholder="8-character code (e.g. SVH9BYGD)"
                autoFocus
              />
              <p className="text-xs text-white/25 mt-1">Ask your gym owner or staff for this code</p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Your Full Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                required
                className={inputCls}
                placeholder="Jane Smith"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={form.countryCode}
                  onChange={set("countryCode")}
                  className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/60 transition-colors flex-shrink-0"
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code} className="bg-slate-800">{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  required
                  className={inputCls}
                  placeholder="555 0100"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  required
                  className={inputCls + " pr-11"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-4.5 h-4.5 rounded border transition-all ${agreed ? "bg-red-600 border-red-600" : "border-white/25 bg-white/5 group-hover:border-white/40"}`}>
                  {agreed && (
                    <svg className="w-3 h-3 text-white absolute top-0.5 left-0.5" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-white/45 leading-relaxed">
                I agree to the{" "}
                <Link href="/terms" className="text-red-400 hover:text-red-300 transition-colors underline underline-offset-2">Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" className="text-red-400 hover:text-red-300 transition-colors underline underline-offset-2">Privacy Policy</Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreed}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all mt-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #dc2626, #b91c1c)",
                boxShadow: agreed ? "0 4px 20px rgba(220,38,38,0.35)" : "none",
              }}
            >
              {loading ? "Joining..." : "Join Gym"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/30">
            Gym owner?{" "}
            <Link href="/signup/gym" className="text-red-400 hover:text-red-300 font-medium transition-colors">
              Register your gym
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-white/30">
            Already have an account?{" "}
            <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
