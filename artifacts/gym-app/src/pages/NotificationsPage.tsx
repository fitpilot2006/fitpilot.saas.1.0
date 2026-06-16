import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Save, CheckCheck, Bell, Settings,
  Clock, CreditCard, Heart, UserX, ExternalLink, Phone,
} from "lucide-react";
import { api } from "../lib/api.js";

interface NotificationSettings {
  id: number; gymId: number;
  twilioAccountSid: string | null; twilioAuthToken: string | null; whatsappNumber: string | null;
  paymentReminderEnabled: boolean; expiryReminderEnabled: boolean;
  welcomeMessageEnabled: boolean; overdueAlertEnabled: boolean;
  paymentReminderDays: number; expiryReminderDays: number;
  paymentTemplate: string | null; expiryTemplate: string | null; welcomeTemplate: string | null;
}
interface Member {
  id: number; name: string; phone: string;
  membershipExpiry: string; status: string;
}
interface Payment {
  id: number; memberId: number; amount: number;
  status: string; dueDate: string;
}
interface Branding { gymName: string; }

const DEFAULT_TEMPLATES = {
  payment: "Hi {member_name}, your payment of {amount} is due on {dueDate}. Please visit the gym to renew your membership.",
  expiry: "Hi {member_name}, your membership at {gym_name} expires on {expiryDate} ({daysLeft} days left). Please renew to continue training!",
  welcome: "Welcome to {gym_name}, {member_name}! 🎉 Your membership is active until {expiryDate}. We're excited to have you!",
};

const TEMPLATE_VARS = ["{member_name}", "{gym_name}", "{amount}", "{dueDate}", "{expiryDate}", "{daysLeft}"];

type Section = "whatsapp" | "reminders" | "templates";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtAmount(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Replace ALL template variables with real member data */
function buildMessage(
  template: string,
  member: Member,
  gymName: string,
  pendingPayment?: { amount: number; dueDate: string },
): string {
  const expiryFormatted = fmtDate(member.membershipExpiry);
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(member.membershipExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ));
  const amountStr = pendingPayment ? fmtAmount(pendingPayment.amount) : "";
  const dueDateStr = pendingPayment?.dueDate ? fmtDate(pendingPayment.dueDate) : expiryFormatted;

  return template
    .replace(/{name}/g, member.name)
    .replace(/{member_name}/g, member.name)
    .replace(/{gym_name}/g, gymName)
    .replace(/{amount}/g, amountStr)
    .replace(/{dueDate}/g, dueDateStr)
    .replace(/{expiryDate}/g, expiryFormatted)
    .replace(/{daysLeft}/g, String(daysLeft));
}

function openWhatsApp(phone: string, message: string) {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  const number = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${number}?text=${encoded}`, "_blank", "noopener,noreferrer");
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("whatsapp");
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    whatsappNumber: "",
    paymentReminderEnabled: false, expiryReminderEnabled: false,
    welcomeMessageEnabled: false, overdueAlertEnabled: false,
    paymentReminderDays: 3, expiryReminderDays: 7,
    paymentTemplate: DEFAULT_TEMPLATES.payment,
    expiryTemplate: DEFAULT_TEMPLATES.expiry,
    welcomeTemplate: DEFAULT_TEMPLATES.welcome,
  });

  const { data: settings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["notification-settings"],
    queryFn: () => api.get("/notifications"),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members", ""],
    queryFn: () => api.get("/members"),
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => api.get("/payments"),
  });

  const { data: branding } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api.get("/branding"),
    staleTime: 300_000,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        whatsappNumber: settings.whatsappNumber ?? "",
        paymentReminderEnabled: settings.paymentReminderEnabled ?? false,
        expiryReminderEnabled: settings.expiryReminderEnabled ?? false,
        welcomeMessageEnabled: settings.welcomeMessageEnabled ?? false,
        overdueAlertEnabled: settings.overdueAlertEnabled ?? false,
        paymentReminderDays: settings.paymentReminderDays ?? 3,
        expiryReminderDays: settings.expiryReminderDays ?? 7,
        paymentTemplate: settings.paymentTemplate ?? DEFAULT_TEMPLATES.payment,
        expiryTemplate: settings.expiryTemplate ?? DEFAULT_TEMPLATES.expiry,
        welcomeTemplate: settings.welcomeTemplate ?? DEFAULT_TEMPLATES.welcome,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => api.put("/notifications", {
      ...form,
      twilioAccountSid: null,
      twilioAuthToken: null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const gymName = branding?.gymName ?? "your gym";

  // Build a lookup: memberId → first pending/overdue payment
  const pendingByMember: Record<number, { amount: number; dueDate: string }> = {};
  for (const p of payments) {
    if (p.status !== "paid" && !pendingByMember[p.memberId]) {
      pendingByMember[p.memberId] = { amount: p.amount, dueDate: p.dueDate };
    }
  }

  // Backend now returns computed status — "expired" for past-expiry active members
  const today = new Date();
  const expiringSoon = members.filter(m => {
    const d = new Date(m.membershipExpiry);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return m.status === "active" && diff >= 0 && diff <= (form.expiryReminderDays ?? 7);
  });
  const overdue = members.filter(m => m.status === "expired");

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: "var(--gym-primary)", borderTopColor: "transparent" }} />
    </div>
  );

  const sections = [
    { key: "whatsapp" as Section, label: "Quick Alerts", icon: MessageSquare },
    { key: "reminders" as Section, label: "Reminder Rules", icon: Bell },
    { key: "templates" as Section, label: "Templates", icon: Settings },
  ];

  return (
    <div className="space-y-5 max-w-3xl fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-slate-400 text-sm mt-0.5">WhatsApp direct alerts · reminder rules · message templates</p>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="flex items-center gap-2 disabled:opacity-50 active:scale-95 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "var(--gym-primary)", boxShadow: "0 4px 14px var(--gym-primary-20)" }}>
          {saved ? <CheckCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveMutation.isPending ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      {/* Section nav */}
      <div className="flex gap-1 bg-slate-800 border border-white/5 rounded-2xl p-1">
        {sections.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-xl text-sm font-medium transition-all ${section === key ? "text-white shadow" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            style={section === key ? { background: "var(--gym-primary)" } : {}}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* QUICK WHATSAPP ALERTS */}
      {section === "whatsapp" && (
        <div className="space-y-4">
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">WhatsApp Direct Message</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any "WhatsApp" button below to open WhatsApp with a pre-filled message. No API setup needed.
              </p>
            </div>
          </div>

          {/* Expiring Soon */}
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Expiring Soon</h3>
              <span className="ml-auto text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">{expiringSoon.length}</span>
            </div>
            {expiringSoon.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">No members expiring soon</p>
            ) : (
              <div className="space-y-2">
                {expiringSoon.map(m => {
                  const msg = buildMessage(form.expiryTemplate, m, gymName, pendingByMember[m.id]);
                  const daysLeft = Math.ceil((new Date(m.membershipExpiry).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-900 rounded-xl">
                      <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-amber-400">{m.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {m.phone} · expires {daysLeft <= 0 ? "today" : `in ${daysLeft}d`}
                        </p>
                      </div>
                      <button onClick={() => openWhatsApp(m.phone, msg)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex-shrink-0">
                        <MessageSquare className="w-3 h-3" /> WhatsApp
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overdue */}
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserX className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-white">Overdue Members</h3>
              <span className="ml-auto text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">{overdue.length}</span>
            </div>
            {overdue.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">No overdue members</p>
            ) : (
              <div className="space-y-2">
                {overdue.map(m => {
                  const msg = buildMessage(form.paymentTemplate, m, gymName, pendingByMember[m.id]);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-900 rounded-xl">
                      <div className="w-8 h-8 bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-red-400">{m.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {m.phone} · expired {fmtDate(m.membershipExpiry)}
                        </p>
                      </div>
                      <button onClick={() => openWhatsApp(m.phone, msg)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-all flex-shrink-0">
                        <MessageSquare className="w-3 h-3" /> WhatsApp
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* All members quick send */}
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Send to Any Member</h3>
            </div>
            <div className="space-y-2">
              {members.slice(0, 10).map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 bg-slate-900 rounded-xl">
                  <div className="w-7 h-7 bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-400">{m.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{m.name}</p>
                    <p className="text-xs text-slate-600 truncate">{m.phone}</p>
                  </div>
                  <button onClick={() => openWhatsApp(m.phone, buildMessage(form.expiryTemplate, m, gymName, pendingByMember[m.id]))}
                    className="flex items-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs px-2.5 py-1 rounded-lg transition-all border border-emerald-500/20 flex-shrink-0">
                    <ExternalLink className="w-3 h-3" /> Chat
                  </button>
                </div>
              ))}
              {members.length > 10 && (
                <p className="text-xs text-slate-500 text-center pt-1">+{members.length - 10} more members</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REMINDER RULES */}
      {section === "reminders" && (
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white">Automatic Reminder Rules</h3>
            <p className="text-xs text-slate-500 mt-0.5">Configure thresholds for the Quick Alerts tab above.</p>
          </div>

          <div className="space-y-4">
            {[
              {
                key: "paymentReminderEnabled" as keyof typeof form,
                icon: CreditCard, label: "Payment Due Reminders",
                desc: "Show in Quick Alerts when payment due date approaches",
                daysKey: "paymentReminderDays" as keyof typeof form,
                daysLabel: "days before due date",
              },
              {
                key: "expiryReminderEnabled" as keyof typeof form,
                icon: Clock, label: "Membership Expiry Reminders",
                desc: "Show in Quick Alerts before membership expires",
                daysKey: "expiryReminderDays" as keyof typeof form,
                daysLabel: "days before expiry",
              },
              {
                key: "welcomeMessageEnabled" as keyof typeof form,
                icon: Heart, label: "Welcome Messages",
                desc: "Notify when new member joins",
                daysKey: null,
              },
              {
                key: "overdueAlertEnabled" as keyof typeof form,
                icon: UserX, label: "Overdue Payment Alerts",
                desc: "Show overdue members in Quick Alerts",
                daysKey: null,
              },
            ].map(({ key, icon: Icon, label, desc, daysKey, daysLabel }) => (
              <div key={key as string} className="flex items-start gap-4 p-4 bg-slate-900 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <div className="p-2.5 rounded-xl flex-shrink-0 transition-colors"
                  style={(form as any)[key] ? { background: "var(--gym-primary-10)" } : { background: "#1e293b" }}>
                  <Icon className="w-4 h-4 transition-colors"
                    style={(form as any)[key] ? { color: "var(--gym-primary)" } : { color: "#64748b" }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                      style={(form as any)[key] ? { background: "var(--gym-primary)" } : { background: "#334155" }}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${(form as any)[key] ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {daysKey && (form as any)[key] && (
                    <div className="mt-3 flex items-center gap-2">
                      <input type="number" min="1" max="30" value={(form as any)[daysKey] as number}
                        onChange={e => setForm(f => ({ ...f, [daysKey as string]: Number(e.target.value) }))}
                        className="w-16 bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-white/20" />
                      <span className="text-xs text-slate-400">{daysLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGE TEMPLATES */}
      {section === "templates" && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-medium text-slate-400 mb-2">Available Variables</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS.map(v => (
                <span key={v} className="font-mono text-xs border px-2 py-0.5 rounded-md"
                  style={{ background: "var(--gym-primary-10)", color: "var(--gym-primary)", borderColor: "var(--gym-primary-20)" }}>{v}</span>
              ))}
            </div>
          </div>

          {[
            { key: "paymentTemplate" as keyof typeof form, label: "Payment Reminder Template", icon: CreditCard },
            { key: "expiryTemplate" as keyof typeof form, label: "Expiry Reminder Template", icon: Clock },
            { key: "welcomeTemplate" as keyof typeof form, label: "Welcome Message Template", icon: Heart },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key as string} className="bg-slate-800 border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
                <h3 className="text-sm font-semibold text-white">{label}</h3>
              </div>
              <textarea value={(form as any)[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={4}
                className="w-full bg-slate-900 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20 resize-none" />
              <div className="bg-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-400 border border-white/5">
                <span className="text-slate-500 font-medium">Preview: </span>
                {buildMessage(
                  (form as any)[key] as string,
                  { id: 0, name: "John Doe", phone: "", membershipExpiry: new Date(Date.now() + 7 * 86400000).toISOString(), status: "active" },
                  gymName,
                  { amount: 49.99, dueDate: new Date(Date.now() + 7 * 86400000).toISOString() },
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
