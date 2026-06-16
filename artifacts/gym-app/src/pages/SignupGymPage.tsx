import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, EyeOff, ArrowLeft,
  Send, ChevronRight, CheckCircle, X,
} from "lucide-react";
import { setAuth } from "../lib/auth.js";
import { api } from "../lib/api.js";

const COUNTRY_CODES = [
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+91", label: "India (+91)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+62", label: "Indonesia (+62)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+27", label: "S. Africa (+27)" },
  { code: "+20", label: "Egypt (+20)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+52", label: "Mexico (+52)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
  { code: "+7", label: "Russia (+7)" },
];

const PLANS = ["starter", "basic", "pro", "enterprise"];

type View = "register" | "apply";

export default function SignupGymPage() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<View>("register");

  const [form, setForm] = useState({ name: "", email: "", password: "", gymName: "", accessCode: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [applyForm, setApplyForm] = useState({
    gymName: "", ownerName: "", countryCode: "+1", phone: "", email: "",
    address: "", planRequest: "starter", notes: "",
  });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  }
  function setApply(k: keyof typeof applyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setApplyForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any }>("/auth/signup/gym", form);
      setAuth(res.token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setApplyError("");
    setApplyLoading(true);
    try {
      await api.post("/gym-applications", applyForm);
      setApplySuccess(true);
    } catch (err: any) {
      setApplyError(err.message ?? "Failed to submit application");
    } finally {
      setApplyLoading(false);
    }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-red-500/60 text-sm transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-red-900/20 rounded-full blur-3xl mobile-hide-glow" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-red-800/15 rounded-full blur-3xl mobile-hide-glow" />
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <img src="/fitpilot-logo.png" alt="FitPilot" className="h-16 w-auto" />
        </div>

        {/* ── REGISTER VIEW ── */}
        {view === "register" && (
          <div className="bg-slate-800 rounded-2xl p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Link href="/login">
                <button className="text-white/30 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <div>
                <h2 className="text-lg font-bold text-white">Register your gym</h2>
                <p className="text-xs text-white/30 mt-0.5">Need an access code from platform admin</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-4 text-red-400 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { key: "gymName", label: "Gym Name", type: "text", placeholder: "Elite Fitness" },
                { key: "name", label: "Your Name", type: "text", placeholder: "John Smith" },
                { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">{label}</label>
                  <input type={type} value={form[key as keyof typeof form]} onChange={set(key as keyof typeof form)}
                    required className={inputCls} placeholder={placeholder} />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")}
                    required className={`${inputCls} pr-10`} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Access Code</label>
                <input type="text" value={form.accessCode} onChange={set("accessCode")} required
                  className={`${inputCls} uppercase font-mono tracking-wider`} placeholder="XXXX-XXXX" />
              </div>

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

              <button type="submit" disabled={loading || !agreed}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 transition-all shadow-xl shadow-red-600/25 active:scale-[0.98] mt-1">
                {loading ? "Creating account..." : "Create gym account"}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-xs text-white/20">or</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            <button
              onClick={() => { setView("apply"); setApplyError(""); setApplySuccess(false); }}
              className="w-full flex items-center gap-3 bg-white/4 hover:bg-white/7 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all group text-left"
            >
              <div className="w-9 h-9 bg-violet-500/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-500/25 transition-colors">
                <Send className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Apply For Access Code</p>
                <p className="text-xs text-white/30 mt-0.5">No code yet? Submit a request to the admin</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-violet-400 transition-all" />
            </button>

            <p className="mt-5 text-center text-xs text-white/25">
              Already have an account? <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">Sign in</Link>
            </p>
          </div>
        )}

        {/* ── APPLY VIEW ── */}
        {view === "apply" && (
          <div className="bg-slate-800 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-6 border-b border-white/8">
              <button onClick={() => setView("register")}
                className="text-white/30 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white">Apply for Access Code</h2>
                <p className="text-xs text-white/30 mt-0.5">Admin will review and send you a code</p>
              </div>
            </div>

            {applySuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Application Submitted!</h3>
                <p className="text-white/35 text-sm mt-2 leading-relaxed">
                  Your request has been received. The platform admin will review it and send you an access code.
                </p>
                <button
                  onClick={() => { setView("register"); setApplySuccess(false); setApplyForm({ gymName: "", ownerName: "", countryCode: "+1", phone: "", email: "", address: "", planRequest: "starter", notes: "" }); }}
                  className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all text-sm shadow-lg shadow-red-600/25">
                  Back to Registration
                </button>
              </div>
            ) : (
              <form onSubmit={handleApply} className="p-6 space-y-4">
                {applyError && (
                  <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                    <X className="w-4 h-4 flex-shrink-0" /> {applyError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Gym Name *</label>
                    <input type="text" value={applyForm.gymName} onChange={setApply("gymName")} required
                      className={inputCls} placeholder="Elite Fitness Center" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Owner Name *</label>
                    <input type="text" value={applyForm.ownerName} onChange={setApply("ownerName")} required
                      className={inputCls} placeholder="John Smith" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Phone Number *</label>
                    <div className="flex gap-2">
                      <select value={applyForm.countryCode} onChange={setApply("countryCode")}
                        className="bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/60 flex-shrink-0 w-36 transition-colors">
                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code} className="bg-zinc-900">{c.label}</option>)}
                      </select>
                      <input type="tel" value={applyForm.phone} onChange={setApply("phone")} required
                        className={`${inputCls} flex-1`} placeholder="5551234567" />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Email *</label>
                    <input type="email" value={applyForm.email} onChange={setApply("email")} required
                      className={inputCls} placeholder="owner@gymname.com" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Gym Address</label>
                    <input type="text" value={applyForm.address} onChange={setApply("address")}
                      className={inputCls} placeholder="123 Main St, City, Country" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Plan Request</label>
                    <select value={applyForm.planRequest} onChange={setApply("planRequest")}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/60 transition-colors">
                      {PLANS.map(p => <option key={p} value={p} className="bg-zinc-900 capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wider">Notes</label>
                    <textarea value={applyForm.notes} onChange={setApply("notes")} rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-red-500/60 text-sm resize-none transition-colors"
                      placeholder="Tell us about your gym, expected member count, etc." />
                  </div>
                </div>

                <button type="submit" disabled={applyLoading}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 transition-all shadow-lg shadow-violet-600/20 active:scale-[0.98]">
                  <Send className="w-4 h-4" />
                  {applyLoading ? "Submitting..." : "Submit Application"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
