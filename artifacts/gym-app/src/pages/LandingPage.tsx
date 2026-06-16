import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView, useAnimation, AnimatePresence } from "framer-motion";
import {
  Users, Calendar, CreditCard, Dumbbell, BarChart3, Smartphone, Building2, Zap,
  CheckCircle, ChevronDown, ChevronUp, Mail, TrendingUp, Clock, Shield,
  ArrowRight, Menu, X, Star, MessageSquare, Cpu, Apple, QrCode, GitBranch,
  UserCog, PieChart, Bell, Brain, Sparkles, ChevronRight, Key, AlertTriangle, Send,
} from "lucide-react";

// ─── ANIMATION VARIANTS ────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } },
};
const stagger = (delay = 0.1) => ({
  show: { transition: { staggerChildren: delay } },
});
const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function Reveal({ children, className = "", delay = 0, variants = fadeUp }: {
  children: React.ReactNode; className?: string; delay?: number; variants?: any;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={variants}
      transition={{ delay } as any}
    >
      {children}
    </motion.div>
  );
}

// ─── ANIMATED COUNTER ──────────────────────────────────────────────────────

function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / 60;
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, to]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ─── FEATURE DATA ──────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Users, title: "Member Management", desc: "Full member profiles, history, emergency contacts, and status tracking in one place." },
  { icon: Calendar, title: "Attendance Tracking", desc: "QR-code check-ins, daily logs, and real-time presence monitoring." },
  { icon: CreditCard, title: "Payment Management", desc: "Log payments, track balances, and get alerted before memberships lapse." },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Revenue trends, member growth, and attendance heatmaps — at a glance." },
  { icon: Shield, title: "Staff Management", desc: "Role-based access for owners, managers, and trainers." },
  { icon: Dumbbell, title: "Workout Plans", desc: "Build and assign personalised training plans directly from the platform." },
  { icon: Building2, title: "Multi-Branch", desc: "Run multiple gym locations under one account with isolated data per branch." },
  { icon: Smartphone, title: "Mobile Friendly", desc: "Fully responsive. Manage your gym from the floor, on any device." },
];

// ─── SCREENSHOT DATA ───────────────────────────────────────────────────────

const SCREENSHOTS = [
  {
    key: "dashboard",
    label: "Dashboard",
    desc: "Your complete gym overview — revenue, members, attendance, and alerts at a glance.",
    content: <DashboardMock />,
  },
  {
    key: "members",
    label: "Members",
    desc: "Full member database with search, filters, and one-click profile access.",
    content: <MembersMock />,
  },
  {
    key: "attendance",
    label: "Attendance",
    desc: "QR scan logs, daily check-ins, and historical attendance patterns.",
    content: <AttendanceMock />,
  },
  {
    key: "payments",
    label: "Payments",
    desc: "Track every payment, outstanding balance, and revenue trend.",
    content: <PaymentsMock />,
  },
  {
    key: "analytics",
    label: "Analytics",
    desc: "Growth metrics, revenue charts, and member retention insights.",
    content: <AnalyticsMock />,
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    desc: "Manage subscription plans, renewals, and expiry alerts.",
    content: <SubscriptionsMock />,
  },
];

// ─── MOCK SCREEN COMPONENTS ────────────────────────────────────────────────

function DashboardMock() {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Total Members", v: "342", c: "+12 this month", col: "#E10600" },
          { l: "Active Today", v: "47", c: "Real-time", col: "#8b5cf6" },
          { l: "Revenue", v: "$8,420", c: "+8% vs last mo", col: "#10b981" },
          { l: "Pending", v: "5", c: "Needs action", col: "#f59e0b" },
        ].map(s => (
          <div key={s.l} className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-[10px] text-white/40">{s.l}</p>
            <p className="text-xl font-black text-white mt-0.5">{s.v}</p>
            <p className="text-[10px] mt-1" style={{ color: s.col }}>{s.c}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 bg-white/5 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-white/6 text-xs font-semibold text-white">Recent Members</div>
          {["Sarah Mitchell", "James Okafor", "Priya Sharma", "Carlos Ruiz"].map((n, i) => (
            <div key={n} className="flex items-center gap-2 px-3 py-2 border-b border-white/4">
              <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{n[0]}</div>
              <p className="text-xs text-white flex-1">{n}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${i === 2 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>{i === 2 ? "Expired" : "Active"}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-white/6 text-xs font-semibold text-white">Today</div>
          {["06:12 · J. Okafor", "07:05 · P. Sharma", "07:33 · S. Mitchell", "08:17 · C. Ruiz"].map(a => (
            <div key={a} className="px-3 py-2 border-b border-white/4 text-[10px] text-white/50 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />{a}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MembersMock() {
  const rows = [
    { name: "Sarah Mitchell", plan: "Pro", status: "Active", joined: "Jan 2026", phone: "+1 555-0101" },
    { name: "James Okafor", plan: "Starter", status: "Active", joined: "Feb 2026", phone: "+1 555-0102" },
    { name: "Priya Sharma", plan: "Pro", status: "Expired", joined: "Oct 2025", phone: "+91 98765" },
    { name: "Carlos Ruiz", plan: "Pro", status: "Active", joined: "Mar 2026", phone: "+52 555-0104" },
    { name: "Aisha Brooks", plan: "Starter", status: "Active", joined: "Apr 2026", phone: "+44 7911" },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white/30">Search members…</div>
        <div className="bg-[#E10600] text-white text-xs font-bold px-3 py-1.5 rounded-lg">+ Add Member</div>
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 px-3 py-2 border-b border-white/6 text-[10px] text-white/30 font-semibold uppercase tracking-wider">
          <span className="col-span-2">Name</span><span>Plan</span><span>Status</span><span>Joined</span>
        </div>
        {rows.map(r => (
          <div key={r.name} className="grid grid-cols-5 items-center px-3 py-2.5 border-b border-white/4 hover:bg-white/4">
            <div className="col-span-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center">{r.name[0]}</div>
              <span className="text-xs text-white truncate">{r.name}</span>
            </div>
            <span className="text-[10px] text-white/50">{r.plan}</span>
            <span className={`text-[10px] font-semibold ${r.status === "Active" ? "text-emerald-400" : "text-red-400"}`}>{r.status}</span>
            <span className="text-[10px] text-white/30">{r.joined}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceMock() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = [32, 45, 38, 51, 47, 28, 19];
  const max = Math.max(...counts);
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[{ l: "Today", v: "47" }, { l: "This Week", v: "286" }, { l: "This Month", v: "1,124" }].map(s => (
          <div key={s.l} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <p className="text-[10px] text-white/40">{s.l}</p>
            <p className="text-xl font-black text-white">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-3">Weekly Attendance</p>
        <div className="flex items-end gap-2 h-20">
          {days.map((d, i) => (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-md transition-all" style={{ height: `${(counts[i] / max) * 64}px`, background: d === "Thu" ? "#E10600" : "rgba(225,6,0,0.25)" }} />
              <span className="text-[9px] text-white/30">{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-white/6 text-xs font-semibold text-white">Today's Log</div>
        {["06:12 · J. Okafor · Check-in", "07:33 · S. Mitchell · Check-in", "08:17 · C. Ruiz · Check-in", "09:02 · A. Brooks · Check-in"].map(e => (
          <div key={e} className="flex items-center gap-2 px-3 py-2 border-b border-white/4">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
            <span className="text-[10px] text-white/60">{e}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsMock() {
  const rows = [
    { name: "Sarah Mitchell", amount: "$79", date: "Jun 1", status: "Paid" },
    { name: "James Okafor", amount: "$29", date: "Jun 1", status: "Paid" },
    { name: "Priya Sharma", amount: "$79", date: "May 1", status: "Overdue" },
    { name: "Carlos Ruiz", amount: "$79", date: "Jun 3", status: "Paid" },
    { name: "Aisha Brooks", amount: "$29", date: "Jun 5", status: "Pending" },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[{ l: "Collected (Month)", v: "$8,420", col: "#10b981" }, { l: "Pending", v: "$316", col: "#f59e0b" }, { l: "Overdue", v: "$79", col: "#E10600" }].map(s => (
          <div key={s.l} className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-[10px] text-white/40">{s.l}</p>
            <p className="text-lg font-black text-white">{s.v}</p>
            <div className="w-full h-0.5 mt-2 rounded-full" style={{ background: s.col }} />
          </div>
        ))}
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2 border-b border-white/6 text-[10px] text-white/30 font-semibold uppercase tracking-wider">
          <span className="col-span-2">Member</span><span>Amount</span><span>Status</span>
        </div>
        {rows.map(r => (
          <div key={r.name} className="grid grid-cols-4 items-center px-3 py-2.5 border-b border-white/4">
            <span className="col-span-2 text-xs text-white">{r.name}</span>
            <span className="text-xs text-white/60">{r.amount}</span>
            <span className={`text-[10px] font-semibold ${r.status === "Paid" ? "text-emerald-400" : r.status === "Overdue" ? "text-red-400" : "text-amber-400"}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsMock() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const revenue = [4200, 5100, 6300, 7400, 7900, 8420];
  const members = [180, 210, 250, 290, 320, 342];
  const max = Math.max(...revenue);
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[{ l: "MoM Growth", v: "+8.4%", col: "#10b981" }, { l: "Retention Rate", v: "91%", col: "#8b5cf6" }].map(s => (
          <div key={s.l} className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-[10px] text-white/40">{s.l}</p>
            <p className="text-2xl font-black" style={{ color: s.col }}>{s.v}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-3">Monthly Revenue</p>
        <div className="flex items-end gap-2 h-24">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-[8px] text-white/40">${(revenue[i] / 1000).toFixed(1)}k</p>
              <div className="w-full rounded-t-md" style={{ height: `${(revenue[i] / max) * 64}px`, background: `linear-gradient(to top, #E10600, rgba(225,6,0,0.4))` }} />
              <span className="text-[8px] text-white/30">{m}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-white">Member Growth</p>
          <span className="text-[10px] text-emerald-400">+162 in 6 months</span>
        </div>
        <div className="flex items-end gap-2 h-10">
          {members.map((v, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-violet-500/30" style={{ height: `${(v / 342) * 40}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SubscriptionsMock() {
  const plans = [
    { name: "Starter", price: "$29/mo", members: 142, pct: 41 },
    { name: "Pro", price: "$79/mo", members: 178, pct: 52 },
    { name: "Enterprise", price: "Custom", members: 22, pct: 7 },
  ];
  const renewals = [
    { name: "Sarah Mitchell", plan: "Pro", expires: "Jun 30", days: 23 },
    { name: "James Okafor", plan: "Starter", expires: "Jun 15", days: 8 },
    { name: "Priya Sharma", plan: "Pro", expires: "Jun 1", days: 0 },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="bg-white/3 border border-white/8 rounded-xl p-4">
        <p className="text-xs font-semibold text-white mb-3">Plan Distribution</p>
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white">{p.name} <span className="text-white/30">{p.price}</span></span>
                <span className="text-xs text-white/50">{p.members} members</span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#E10600]" style={{ width: `${p.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-white/6 text-xs font-semibold text-white">Upcoming Renewals</div>
        {renewals.map(r => (
          <div key={r.name} className="flex items-center gap-3 px-3 py-2.5 border-b border-white/4">
            <div className="flex-1">
              <p className="text-xs text-white">{r.name}</p>
              <p className="text-[10px] text-white/30">{r.plan} · Expires {r.expires}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.days === 0 ? "bg-red-500/20 text-red-400" : r.days < 10 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
              {r.days === 0 ? "Expired" : `${r.days}d left`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TESTIMONIALS ──────────────────────────────────────────────────────────

const TESTIMONIALS = [
  { name: "Marcus Johnson", role: "Owner · Iron Peak Fitness", quote: "FitPilot replaced three different apps for us. Our member renewals are up 40% and I spend half as much time on admin.", rating: 5 },
  { name: "Aisha Patel", role: "Owner · The Movement Studio", quote: "The QR check-in alone saved my front desk team 2 hours a day. The dashboard is clean, fast, and everything just works.", rating: 5 },
  { name: "Carlos Mendez", role: "Manager · PowerZone Gym", quote: "Finally a gym platform that doesn't feel like it was built in 2012. The member portal is something our members actually love using.", rating: 5 },
  { name: "Sophie Nkrumah", role: "Owner · FitLife Center", quote: "We went from chasing payments manually to having all overdue members flagged automatically. It pays for itself.", rating: 5 },
  { name: "Tom Harrington", role: "Director · Urban Athletics", quote: "Multi-branch support is fantastic. I can see all three locations in one view without any data bleeding between gyms.", rating: 5 },
];

// ─── COMING SOON ───────────────────────────────────────────────────────────

const ROADMAP = [
  { icon: Smartphone, label: "Mobile Apps (iOS & Android)", desc: "Native apps for gym owners, staff, and members — with push notifications and offline access." },
  { icon: QrCode, label: "QR Code Check-In", desc: "Contactless member check-in via QR scanning at the door — no front desk needed." },
  { icon: Brain, label: "AI Business Insights", desc: "AI-powered recommendations for pricing, retention, and revenue growth opportunities." },
  { icon: Bell, label: "Automated Lead Management", desc: "Capture and nurture gym leads automatically — from first enquiry to signed membership." },
  { icon: UserCog, label: "Trainer Performance Tracking", desc: "Monitor trainer sessions, client ratings, and output — all in one dashboard." },
  { icon: Star, label: "Member Progress Photos", desc: "Before/after photo galleries stored securely on member profiles for transformation tracking." },
  { icon: TrendingUp, label: "Smart Membership Renewals", desc: "AI-powered renewal reminders and one-click renewal flows that reduce churn automatically." },
  { icon: Building2, label: "Public Gym Website Builder", desc: "Create a professional branded website for your gym in minutes — no developer needed." },
  { icon: Calendar, label: "Online Class Booking", desc: "Let members browse and book classes, PT sessions, and group training online." },
  { icon: CreditCard, label: "Stripe Subscription Billing", desc: "Automated recurring billing and payment collection — memberships renew themselves." },
];

// ─── PLANS ─────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Basic", regularPrice: "$19", launchPrice: "$9.50", period: "/month",
    desc: "Perfect for independent gym owners just getting started.",
    features: [
      "Up to 100 Members",
      "Member Management",
      "Attendance Tracking",
      "Payment Management",
      "Basic Reports",
    ],
    cta: "Start Free Trial", highlight: false,
  },
  {
    name: "Pro", regularPrice: "$49", launchPrice: "$24.50", period: "/month",
    desc: "For growing gyms that need AI-powered tools and more capacity.",
    features: [
      "Up to 500 Members",
      "Everything in Basic",
      "AI Workout Generator",
      "AI Diet Planner",
      "Advanced Reports",
      "Multi Staff Accounts",
    ],
    cta: "Start Free Trial", highlight: true,
  },
  {
    name: "Enterprise", regularPrice: "$99", launchPrice: "$49.50", period: "/month",
    desc: "For gym chains and large multi-location operations.",
    features: [
      "Unlimited Members",
      "Everything in Pro",
      "Multi Branch Support",
      "Advanced Analytics",
      "Priority Support",
    ],
    cta: "Request Access Code", highlight: false,
  },
];

// ─── FAQ ───────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "How does the free trial work?", a: "Register your gym with an access code — no credit card required. Contact us at fitpilot.saas@gmail.com to request one." },
  { q: "How do members access the platform?", a: "Each gym gets a unique join code. Members sign up at /signup/member using that code, then access their personal portal with their QR check-in code, workout plans, and membership status." },
  { q: "Is my gym's data private from other gyms?", a: "Yes. FitPilot is a multi-tenant platform with strict data isolation — no gym can ever see another gym's data." },
  { q: "Can I add multiple staff members?", a: "Absolutely. Pro and Enterprise plans include role-based access for trainers, front-desk staff, and managers." },
  { q: "What happens when a membership expires?", a: "FitPilot automatically flags expired memberships and surfaces renewal alerts so neither you nor your members are caught off guard." },
  { q: "Does FitPilot support multiple gym locations?", a: "Yes. Multi-branch support is available on Pro and Enterprise plans — separate data per branch, unified owner view." },
  { q: "Is FitPilot mobile-friendly?", a: "Fully responsive. The owner/staff dashboard and member portal work flawlessly on any device." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div layout className="border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="font-semibold text-white text-sm">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="px-5 pb-4 text-sm text-white/45 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

const defaultAppForm = { gymName: "", ownerName: "", email: "", phone: "", memberCount: "", planRequest: "basic" };

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [appForm, setAppForm] = useState(defaultAppForm);
  const [appStatus, setAppStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [appError, setAppError] = useState("");

  async function handleAppSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appForm.gymName || !appForm.ownerName || !appForm.email || !appForm.phone) return;
    setAppStatus("submitting");
    setAppError("");
    try {
      const res = await fetch("/api/gym-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymName: appForm.gymName,
          ownerName: appForm.ownerName,
          email: appForm.email,
          phone: appForm.phone,
          memberCount: appForm.memberCount ? Number(appForm.memberCount) : null,
          planRequest: appForm.planRequest,
          countryCode: "+1",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Submission failed");
      }
      setAppStatus("success");
      setAppForm(defaultAppForm);
    } catch (err) {
      setAppError((err as Error).message ?? "Something went wrong");
      setAppStatus("error");
    }
  }

  const activeScreen = SCREENSHOTS.find(s => s.key === activeTab)!;

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 bg-black/75 backdrop-blur-2xl border-b border-white/6"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <img src="/fitpilot-logo.png" alt="FitPilot" className="h-9 w-auto" />
          <div className="hidden sm:flex items-center gap-6 text-sm text-white/40">
            {["Features", "Pricing", "FAQ"].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`} className="hover:text-white transition-colors">{item}</a>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/login">
              <button className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">Login</button>
            </Link>
            <Link href="/signup/gym">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 bg-[#E10600] hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-red-600/30"
              >
                Start Free Trial
              </motion.button>
            </Link>
          </div>
          <button onClick={() => setMobileOpen(v => !v)} className="sm:hidden text-white/60 hover:text-white p-1.5 transition-colors">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="sm:hidden border-t border-white/6 bg-black/95 px-4 py-4 space-y-2 overflow-hidden"
            >
              {["#features", "#pricing", "#faq"].map((href, i) => (
                <a key={href} href={href} onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors capitalize">
                  {href.slice(1)}
                </a>
              ))}
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors">Login</button>
              </Link>
              <Link href="/signup/gym" onClick={() => setMobileOpen(false)}>
                <button className="w-full bg-[#E10600] text-white text-sm font-bold rounded-xl py-3 transition-all">Start Free Trial</button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-32 px-4 sm:px-6">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.12, 0.18, 0.12] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(ellipse, #E10600 0%, transparent 70%)" }}
          />
          <div className="absolute top-60 -left-40 w-80 h-80 bg-red-900/10 rounded-full blur-3xl" />
          <div className="absolute top-60 -right-40 w-80 h-80 bg-red-900/10 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#E10600]/10 border border-[#E10600]/25 rounded-full px-4 py-1.5 mb-8"
          >
            <Zap className="w-3.5 h-3.5 text-[#E10600]" />
            <span className="text-xs font-semibold text-[#E10600] uppercase tracking-widest">Powering Stronger Gyms</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.04] mb-6"
          >
            Run Your Gym<br />
            <span className="text-[#E10600]">Like a Pro</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-lg sm:text-xl text-white/45 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            Manage memberships, attendance, payments, staff, and gym operations from one powerful platform built for serious gym owners.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16"
          >
            <Link href="/signup/gym">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 20px 60px rgba(225,6,0,0.45)" }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 bg-[#E10600] text-white font-bold px-8 py-4 rounded-2xl text-base transition-colors shadow-2xl shadow-red-600/30"
              >
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/12 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all"
              >
                Login
              </motion.button>
            </Link>
          </motion.div>

          {/* Floating dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative max-w-3xl mx-auto"
            >
              {/* Glow under card */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-20 bg-[#E10600]/20 blur-2xl rounded-full" />
              {/* Browser shell */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d0d0d]">
                <div className="flex items-center gap-2 px-4 py-3 bg-[#111]/80 border-b border-white/6">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <div className="ml-4 flex-1 bg-white/6 rounded-lg px-4 py-1 text-[11px] text-white/20 max-w-xs mx-auto text-center">
                    app.fitpilot.io/dashboard
                  </div>
                </div>
                <DashboardMock />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────── */}
      <section className="py-14 px-4 sm:px-6 border-y border-white/6 bg-[#080808]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { icon: Zap, title: "Launch in 5 Minutes", desc: "No complex setup. Register, log in, start managing." },
            { icon: Smartphone, title: "Works on Any Device", desc: "Fully responsive — desktop, tablet, or phone." },
            { icon: Clock, title: "Real-Time Dashboard", desc: "Live attendance, revenue, and member data." },
            { icon: Shield, title: "No Lock-In Contracts", desc: "Upgrade or cancel at any time. You're in control." },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.title} delay={i * 0.08} className="flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 bg-[#E10600]/12 rounded-xl flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[#E10600]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs text-white/35 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── SCREENSHOT SHOWCASE ───────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Reveal>
              <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">Platform Preview</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Every tool you need, beautifully designed</h2>
              <p className="text-white/40 mt-3 max-w-xl mx-auto text-sm">
                Explore the six core modules that run your entire gym operation.
              </p>
            </Reveal>
          </div>

          {/* Tab pills */}
          <Reveal className="flex flex-wrap justify-center gap-2 mb-8">
            {SCREENSHOTS.map(s => (
              <motion.button
                key={s.key}
                onClick={() => setActiveTab(s.key)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  activeTab === s.key
                    ? "bg-[#E10600] border-[#E10600] text-white shadow-lg shadow-red-600/25"
                    : "bg-white/4 border-white/8 text-white/50 hover:text-white hover:border-white/20"
                }`}
              >
                {s.label}
              </motion.button>
            ))}
          </Reveal>

          {/* Tab content */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/8 overflow-hidden bg-[#0d0d0d] shadow-2xl shadow-black/60"
              >
                {/* Header bar */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#111] border-b border-white/6">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <div className="bg-white/6 rounded-lg px-4 py-1 text-[10px] text-white/20">
                    FitPilot · {activeScreen.label}
                  </div>
                  <div className="w-16" />
                </div>
                {activeScreen.content}
              </motion.div>
            </AnimatePresence>
            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-white">{activeScreen.label}</p>
              <p className="text-xs text-white/35 mt-1">{activeScreen.desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 bg-[#080808]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Reveal>
              <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">Features</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Everything your gym needs</h2>
              <p className="text-white/40 mt-3 max-w-xl mx-auto text-sm">
                One platform replaces the spreadsheets, WhatsApp groups, and manual notebooks holding your gym back.
              </p>
            </Reveal>
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={stagger(0.07)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={scaleIn}
                whileHover={{ y: -4, borderColor: "rgba(225,6,0,0.4)" }}
                className="group bg-white/3 border border-white/6 rounded-2xl p-5 cursor-default transition-colors"
              >
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  className="w-10 h-10 bg-[#E10600]/12 rounded-xl flex items-center justify-center mb-4"
                >
                  <Icon className="w-5 h-5 text-[#E10600]" />
                </motion.div>
                <h3 className="font-bold text-white text-sm mb-2">{title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── AI COACHING ──────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-[#080808]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Reveal>
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 rounded-full px-4 py-1.5 mb-4">
                <Brain className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Now Live</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">AI-Powered Member Coaching</h2>
              <p className="text-white/40 mt-3 max-w-xl mx-auto text-sm">
                FitPilot's AI tools are built into every gym account — no extra cost, no integrations required.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Workout card */}
            <Reveal delay={0}>
              <motion.div
                whileHover={{ y: -4, borderColor: "rgba(225,6,0,0.35)" }}
                className="group relative bg-white/3 border border-white/8 rounded-2xl p-6 overflow-hidden transition-all h-full"
              >
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "radial-gradient(circle, rgba(225,6,0,0.12) 0%, transparent 70%)" }} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 bg-[#E10600]/15 rounded-xl flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-[#E10600]" />
                    </div>
                    <span className="text-[10px] font-bold bg-[#E10600]/15 text-[#E10600] px-2 py-1 rounded-full uppercase tracking-wider">Live Feature</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">4-Week Workout Generator</h3>
                  <p className="text-sm text-white/45 leading-relaxed mb-5">
                    Input a member's goal, fitness level, and training location — the AI outputs a full 4-week progressive program with week-by-week exercise variation, sets, reps, rest, and coaching notes.
                  </p>
                  <ul className="space-y-2 mb-5">
                    {[
                      "Foundation → Volume → Intensity → Peak progression",
                      "Gym, home & outdoor training variants",
                      "Injury-aware exercise substitutions",
                      "Save plans directly to member profiles",
                    ].map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-white/55">
                        <CheckCircle className="w-3.5 h-3.5 text-[#E10600] flex-shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5 text-xs text-white/30">
                    <Zap className="w-3.5 h-3.5 text-[#E10600]" />
                    <span>Pro &amp; Enterprise plans · Gym staff dashboard</span>
                  </div>
                </div>
              </motion.div>
            </Reveal>

            {/* AI Diet card */}
            <Reveal delay={0.1}>
              <motion.div
                whileHover={{ y: -4, borderColor: "rgba(139,92,246,0.35)" }}
                className="group relative bg-white/3 border border-white/8 rounded-2xl p-6 overflow-hidden transition-all h-full"
              >
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 bg-violet-500/15 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <span className="text-[10px] font-bold bg-violet-500/15 text-violet-400 px-2 py-1 rounded-full uppercase tracking-wider">Live Feature</span>
                  </div>
                  <h3 className="text-lg font-black text-white mb-2">Personalised Diet Planner</h3>
                  <p className="text-sm text-white/45 leading-relaxed mb-5">
                    Generate science-backed meal plans using TDEE calculation, BMI analysis, and dietary preferences. Plans are calorie-accurate with full macro breakdowns for every meal.
                  </p>
                  <ul className="space-y-2 mb-5">
                    {[
                      "Standard, Vegetarian, Vegan & Halal templates",
                      "5 activity level multipliers for accurate TDEE",
                      "Full macro breakdown per meal (P / C / F)",
                      "Hydration targets and weekly nutrition tips",
                    ].map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-white/55">
                        <CheckCircle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5 text-xs text-white/30">
                    <Zap className="w-3.5 h-3.5 text-violet-400" />
                    <span>Pro &amp; Enterprise plans · Gym staff dashboard</span>
                  </div>
                </div>
              </motion.div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="mt-8 rounded-2xl border border-white/6 bg-white/2 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              {[
                { icon: Brain, label: "AI-Generated",    desc: "Every plan is unique to the member's profile and goals" },
                { icon: Zap,   label: "Instant Results", desc: "Plans generate in seconds — no manual programming needed" },
                { icon: Users, label: "Saved to Profiles", desc: "Plans are stored on the member record for future reference" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white/50" />
                  </div>
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-white/35 leading-relaxed max-w-[200px]">{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY FITPILOT ─────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <Reveal>
              <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">Why FitPilot</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Built for gym owners,<br />not spreadsheets
              </h2>
              <p className="text-white/40 text-sm leading-relaxed">
                FitPilot cuts the admin noise so you focus on what actually grows your gym — great coaching, happy members, and a thriving community.
              </p>
            </Reveal>
          </div>
          <motion.div
            className="space-y-3"
            variants={stagger(0.09)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {[
              { icon: Clock, title: "Save Administrative Time", desc: "Automate renewal reminders, attendance logs, and payment tracking." },
              { icon: CreditCard, title: "Reduce Missed Payments", desc: "Proactive alerts flag overdue payments before they become write-offs." },
              { icon: TrendingUp, title: "Improve Member Retention", desc: "Track engagement, flag at-risk members, and act before they leave." },
              { icon: BarChart3, title: "Track Business Growth", desc: "Revenue dashboards show exactly how your gym is performing month-over-month." },
              { icon: Building2, title: "Manage Multiple Branches", desc: "Scale from one gym to many without switching between apps." },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={{ x: 4 }}
                className="flex items-start gap-4 bg-white/3 border border-white/6 rounded-2xl p-4 transition-all hover:border-[#E10600]/25"
              >
                <div className="w-10 h-10 bg-[#E10600]/12 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#E10600]" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{title}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-[#080808] overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Reveal>
              <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Gym owners love FitPilot</h2>
            </Reveal>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TESTIMONIALS.slice(0, 3).map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-white/3 border border-white/8 rounded-2xl p-6 h-full flex flex-col hover:border-[#E10600]/25 transition-colors"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-[#E10600] text-[#E10600]" />
                    ))}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed flex-1 italic">"{t.quote}"</p>
                  <div className="mt-5 pt-4 border-t border-white/6">
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-white/35 mt-0.5">{t.role}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 max-w-3xl mx-auto">
            {TESTIMONIALS.slice(3).map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-white/3 border border-white/8 rounded-2xl p-6 h-full flex flex-col hover:border-[#E10600]/25 transition-colors"
                >
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-[#E10600] text-[#E10600]" />
                    ))}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed flex-1 italic">"{t.quote}"</p>
                  <div className="mt-5 pt-4 border-t border-white/6">
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-white/35 mt-0.5">{t.role}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <Reveal>
              <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Simple, transparent pricing</h2>
              <p className="text-white/40 mt-3 max-w-lg mx-auto text-sm">Start free, scale when you're ready. No hidden fees, no long-term contracts.</p>
            </Reveal>
          </div>

          {/* Launch promo banner */}
          <Reveal delay={0.05}>
            <div className="mb-8 flex items-center justify-center">
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/35 rounded-2xl px-5 py-3">
                <div className="flex items-center justify-center w-8 h-8 bg-amber-500/20 rounded-xl flex-shrink-0">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-300 font-black text-sm tracking-wide">🚀 LAUNCH OFFER — 50% OFF FIRST 3 MONTHS</p>
                  <p className="text-amber-400/60 text-xs mt-0.5">Limited time. Lock in your launch price today.</p>
                </div>
              </div>
            </div>
          </Reveal>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            variants={stagger(0.12)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {PLANS.map(plan => (
              <motion.div
                key={plan.name}
                variants={scaleIn}
                whileHover={{ y: plan.highlight ? -6 : -4 }}
                className={`relative rounded-2xl p-6 border flex flex-col ${
                  plan.highlight
                    ? "bg-gradient-to-b from-[#E10600]/12 to-[#E10600]/4 border-[#E10600]/45 shadow-2xl shadow-red-600/15"
                    : "bg-white/3 border-white/8"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E10600] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg">
                    Most Popular
                  </div>
                )}
                {/* 50% badge */}
                <div className="absolute top-4 right-4 bg-amber-500/20 border border-amber-500/35 rounded-full px-2 py-0.5">
                  <span className="text-[10px] font-bold text-amber-400">50% OFF</span>
                </div>
                <div className="mb-5">
                  <p className="font-black text-white text-xl">{plan.name}</p>
                  <div className="mt-2">
                    <div className="flex items-end gap-1.5">
                      <span className="text-4xl font-black text-white">{plan.launchPrice}</span>
                      <span className="text-white/30 text-sm mb-1">{plan.period}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-white/30 text-xs line-through">{plan.regularPrice}{plan.period}</span>
                      <span className="text-xs text-amber-400 font-medium">for first 3 months</span>
                    </div>
                  </div>
                  <p className="text-xs text-white/40 mt-2 leading-relaxed">{plan.desc}</p>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-xs text-white/55">
                      <CheckCircle className="w-3.5 h-3.5 text-[#E10600] flex-shrink-0 mt-0.5" />{f}
                    </li>
                  ))}
                </ul>
                {plan.name === "Enterprise" ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => document.getElementById("request-access")?.scrollIntoView({ behavior: "smooth" })}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-white/8 hover:bg-white/14 border border-white/10 text-white"
                  >
                    {plan.cta}
                  </motion.button>
                ) : (
                  <Link href="/signup/gym">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                        plan.highlight
                          ? "bg-[#E10600] hover:bg-red-700 text-white shadow-lg shadow-red-600/30"
                          : "bg-white/8 hover:bg-white/14 border border-white/10 text-white"
                      }`}
                    >
                      {plan.cta}
                    </motion.button>
                  </Link>
                )}
              </motion.div>
            ))}
          </motion.div>
          <Reveal>
            <p className="text-center text-xs text-white/25 mt-6">All plans include a 14-day free trial. No credit card required.</p>
          </Reveal>
        </div>
      </section>

      {/* ── COMING SOON ──────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-[#080808]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Reveal>
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 rounded-full px-4 py-1.5 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Coming Soon</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">The future of gym management</h2>
              <p className="text-white/40 mt-3 max-w-xl mx-auto text-sm">
                We're building the most intelligent gym platform on earth. Here's what's coming next.
              </p>
            </Reveal>
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={stagger(0.06)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {ROADMAP.map(({ icon: Icon, label, desc }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                whileHover={{ y: -3, borderColor: "rgba(139,92,246,0.3)" }}
                className="group flex items-start gap-4 bg-white/3 border border-white/6 rounded-2xl p-5 transition-all"
              >
                <div className="w-10 h-10 bg-violet-500/12 group-hover:bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-white text-sm">{label}</p>
                    <span className="text-[9px] font-bold bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Soon</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── REQUEST ACCESS CODE ──────────────────────────────── */}
      <section id="request-access" className="py-24 px-4 sm:px-6 bg-[#080808]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <Reveal>
              <div className="inline-flex items-center gap-2 bg-[#E10600]/10 border border-[#E10600]/25 rounded-full px-4 py-1.5 mb-4">
                <Key className="w-3.5 h-3.5 text-[#E10600]" />
                <span className="text-xs font-semibold text-[#E10600] uppercase tracking-widest">Get Started</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Request Access Code</h2>
              <p className="text-white/40 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
                Fill in your details and our team will review your application and send you an access code — usually within 24 hours.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            {appStatus === "success" ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-10 text-center">
                <div className="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Application Submitted!</h3>
                <p className="text-sm text-white/50 leading-relaxed max-w-sm mx-auto">
                  We've received your request and will review it shortly. You'll hear from us at the email you provided.
                </p>
                <button
                  onClick={() => setAppStatus("idle")}
                  className="mt-6 px-6 py-2.5 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/14 border border-white/10 text-white transition-all">
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={handleAppSubmit} className="bg-white/3 border border-white/8 rounded-2xl p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Gym Name *</label>
                    <input
                      type="text" placeholder="e.g. Iron Peak Fitness"
                      value={appForm.gymName}
                      onChange={e => setAppForm(f => ({ ...f, gymName: e.target.value }))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#E10600]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Owner Name *</label>
                    <input
                      type="text" placeholder="Your full name"
                      value={appForm.ownerName}
                      onChange={e => setAppForm(f => ({ ...f, ownerName: e.target.value }))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#E10600]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Email Address *</label>
                    <input
                      type="email" placeholder="you@yourgym.com"
                      value={appForm.email}
                      onChange={e => setAppForm(f => ({ ...f, email: e.target.value }))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#E10600]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Phone Number *</label>
                    <input
                      type="tel" placeholder="+1 555 000 0000"
                      value={appForm.phone}
                      onChange={e => setAppForm(f => ({ ...f, phone: e.target.value }))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#E10600]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Number of Members</label>
                    <input
                      type="number" min="1" placeholder="e.g. 150"
                      value={appForm.memberCount}
                      onChange={e => setAppForm(f => ({ ...f, memberCount: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#E10600]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50">Plan Interested In</label>
                    <select
                      value={appForm.planRequest}
                      onChange={e => setAppForm(f => ({ ...f, planRequest: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#E10600]/50 transition-colors">
                      <option value="basic">Basic — $9.50/mo launch</option>
                      <option value="pro">Pro — $24.50/mo launch</option>
                      <option value="enterprise">Enterprise — $49.50/mo launch</option>
                    </select>
                  </div>
                </div>

                {appStatus === "error" && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {appError || "Something went wrong. Please try again."}
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={appStatus === "submitting"}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-[#E10600] hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-600/25 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {appStatus === "submitting" ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Submit Application</>
                  )}
                </motion.button>
                <p className="text-center text-xs text-white/25">We typically respond within 24 hours</p>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Reveal>
              <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">FAQ</p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Common questions</h2>
            </Reveal>
          </div>
          <motion.div
            className="space-y-3"
            variants={stagger(0.07)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
          >
            {FAQS.map(({ q, a }) => (
              <motion.div key={q} variants={fadeUp}>
                <FAQItem q={q} a={a} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CONTACT / FINAL CTA ───────────────────────────────── */}
      <section id="contact" className="py-28 px-4 sm:px-6 relative overflow-hidden bg-[#080808]">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.14, 0.08] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-64 rounded-full blur-3xl"
            style={{ background: "radial-gradient(ellipse, #E10600 0%, transparent 70%)" }}
          />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <Reveal>
            <p className="text-xs font-semibold text-[#E10600] uppercase tracking-widest mb-3">Get In Touch</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              Ready to transform<br />your gym?
            </h2>
            <p className="text-white/40 text-sm mb-10 leading-relaxed max-w-lg mx-auto">
              Start your free 14-day trial today with no credit card required. Or reach out and our team will get back to you within a few hours.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link href="/signup/gym">
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 20px 60px rgba(225,6,0,0.40)" }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 bg-[#E10600] text-white font-bold px-8 py-4 rounded-2xl text-sm transition-colors shadow-xl shadow-red-600/25"
                >
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>
              <a href="mailto:fitpilot.saas@gmail.com?subject=FitPilot%20Enquiry&body=Hi%20FitPilot%20Team%2C%0A%0A">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/12 text-white font-semibold px-8 py-4 rounded-2xl text-sm transition-all"
                >
                  <Mail className="w-4 h-4" /> Email Us
                </motion.button>
              </a>
            </div>
            <a href="mailto:fitpilot.saas@gmail.com?subject=FitPilot%20Enquiry&body=Hi%20FitPilot%20Team%2C%0A%0A" className="text-sm text-white/25 hover:text-white/50 transition-colors">
              fitpilot.saas@gmail.com
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-black border-t border-white/6 px-4 sm:px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-10">
            <div>
              <img src="/fitpilot-logo.png" alt="FitPilot" className="h-8 w-auto mb-2" />
              <p className="text-xs text-white/25">Powering Stronger Gyms</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-3 text-xs text-white/30">
              <div className="space-y-3">
                <p className="text-white/60 font-semibold text-xs uppercase tracking-wider">Product</p>
                <a href="#features" className="block hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="block hover:text-white transition-colors">Pricing</a>
                <a href="#faq" className="block hover:text-white transition-colors">FAQ</a>
              </div>
              <div className="space-y-3">
                <p className="text-white/60 font-semibold text-xs uppercase tracking-wider">Account</p>
                <Link href="/login" className="block hover:text-white transition-colors">Login</Link>
                <Link href="/signup/gym" className="block hover:text-white transition-colors">Register Gym</Link>
                <Link href="/signup/member" className="block hover:text-white transition-colors">Join as Member</Link>
              </div>
              <div className="space-y-3">
                <p className="text-white/60 font-semibold text-xs uppercase tracking-wider">Legal</p>
                <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
                <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                <a href="mailto:fitpilot.saas@gmail.com" className="block hover:text-white transition-colors">Contact</a>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/20">
            <span>© 2026 FitPilot. All rights reserved.</span>
            <span>Made for gym owners who mean business.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
