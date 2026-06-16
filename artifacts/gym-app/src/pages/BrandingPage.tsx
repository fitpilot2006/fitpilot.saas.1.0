import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Palette, Type, Image, Globe, CheckCheck, Sparkles, Upload, X } from "lucide-react";
import { api } from "../lib/api.js";
import { getToken } from "../lib/auth.js";

interface Branding {
  id: number; gymName: string; tagline: string | null;
  logoUrl: string | null; bannerUrl: string | null; thumbnailUrl: string | null;
  primaryColor: string; secondaryColor: string; accentColor: string | null;
  sidebarColor: string | null; cardColor: string | null; buttonColor: string | null;
  themeName: string | null; headingFont: string | null; bodyFont: string | null;
  address: string | null; phone: string | null; email: string | null;
  website: string | null; customCss: string | null;
}

const THEME_PRESETS = [
  { name: "midnight-orange", label: "Midnight Orange", primary: "#f97316", secondary: "#0f172a", sidebar: "#0a0f1e", accent: "#fb923c" },
  { name: "ocean-blue", label: "Ocean Blue", primary: "#3b82f6", secondary: "#0f172a", sidebar: "#0a1628", accent: "#60a5fa" },
  { name: "neon-green", label: "Neon Green", primary: "#22c55e", secondary: "#0a0f0a", sidebar: "#020d02", accent: "#4ade80" },
  { name: "royal-purple", label: "Royal Purple", primary: "#8b5cf6", secondary: "#0f0a1e", sidebar: "#0a0816", accent: "#a78bfa" },
  { name: "premium-gold", label: "Premium Gold", primary: "#f59e0b", secondary: "#111008", sidebar: "#0a0900", accent: "#fbbf24" },
  { name: "rose-red", label: "Rose Red", primary: "#f43f5e", secondary: "#120a0c", sidebar: "#0f0508", accent: "#fb7185" },
  { name: "custom", label: "Custom Theme", primary: "", secondary: "", sidebar: "", accent: "" },
];

const FONTS = ["Inter", "Poppins", "Roboto", "Montserrat", "DM Sans", "Nunito", "Raleway", "Outfit"];

type Section = "identity" | "theme" | "colors" | "typography" | "media" | "contact";

function ImageUploader({
  label, hint, value, onChange,
}: {
  label: string; hint: string; value: string | null | undefined;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
    } catch (e: any) {
      alert(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
        className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
          dragOver ? "border-white/40 bg-white/5" : "border-white/10 bg-slate-900 hover:border-white/20"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: "var(--gym-primary)", borderTopColor: "transparent" }} />
            <p className="text-xs text-slate-400">Uploading...</p>
          </div>
        ) : value ? (
          <div className="relative">
            <img src={value} alt={label} className="max-h-24 mx-auto rounded-xl object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(""); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
            <p className="text-xs text-slate-500 mt-2">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm text-slate-300 font-medium">Click or drag to upload</p>
              <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Branding>>({});
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<Section>("identity");

  const { data: branding, isLoading } = useQuery<Branding>({
    queryKey: ["branding"],
    queryFn: () => api.get("/branding"),
  });

  useEffect(() => { if (branding) setForm(branding); }, [branding]);

  const updateMutation = useMutation({
    mutationFn: () => api.put("/branding", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function setInput<K extends keyof Branding>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function applyTheme(preset: typeof THEME_PRESETS[0]) {
    if (preset.name === "custom") {
      setForm(f => ({ ...f, themeName: "custom" }));
      setSection("colors");
      return;
    }
    setForm(f => ({
      ...f,
      themeName: preset.name,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      sidebarColor: preset.sidebar,
      accentColor: preset.accent,
      buttonColor: preset.primary,
    }));
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: "var(--gym-primary)", borderTopColor: "transparent" }} />
    </div>
  );

  const tabs: { key: Section; label: string; icon: React.ElementType }[] = [
    { key: "identity", label: "Identity", icon: Globe },
    { key: "theme", label: "Themes", icon: Sparkles },
    { key: "colors", label: "Colors", icon: Palette },
    { key: "typography", label: "Typography", icon: Type },
    { key: "media", label: "Media", icon: Image },
    { key: "contact", label: "Contact", icon: Globe },
  ];

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Branding Studio</h1>
          <p className="text-slate-400 text-sm mt-0.5">Customize your gym's look and feel</p>
        </div>
        <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
          className="flex items-center gap-2 disabled:opacity-50 active:scale-95 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "var(--gym-primary)", boxShadow: "0 4px 14px var(--gym-primary-20)" }}>
          {saved ? <CheckCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {updateMutation.isPending ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Live Preview Banner */}
      <div className="rounded-2xl p-5 border border-white/10 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${form.secondaryColor ?? "#0f172a"} 0%, ${form.primaryColor ?? "#f97316"}22 100%)`,
          borderColor: `${form.primaryColor ?? "#f97316"}30`,
        }}>
        <div className="flex items-center gap-3">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
          ) : (
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg font-bold text-lg"
              style={{ background: form.primaryColor ?? "#f97316", color: "#fff" }}>
              {(form.gymName ?? "G")[0]}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: form.headingFont ?? "Inter" }}>
              {form.gymName ?? "Your Gym"}
            </h2>
            <p className="text-sm opacity-70 text-white/80" style={{ fontFamily: form.bodyFont ?? "Inter" }}>
              {form.tagline ?? "Your tagline here"}
            </p>
          </div>
          <div className="ml-auto">
            <span className="px-3 py-1 rounded-lg text-xs font-semibold text-white" style={{ background: form.primaryColor ?? "#f97316" }}>
              Live Preview
            </span>
          </div>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 flex-wrap bg-slate-800 border border-white/5 rounded-2xl p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${section === key ? "text-white shadow" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            style={section === key ? { background: "var(--gym-primary)" } : {}}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-5">
        {/* Identity */}
        {section === "identity" && (
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">Gym Identity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Gym Name *</label>
                <input type="text" value={form.gymName ?? ""} onChange={setInput("gymName")} placeholder="My Awesome Gym"
                  className="w-full bg-slate-900 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Tagline</label>
                <input type="text" value={form.tagline ?? ""} onChange={setInput("tagline")} placeholder="Train harder, achieve more"
                  className="w-full bg-slate-900 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
              </div>
            </div>
          </div>
        )}

        {/* Theme Presets */}
        {section === "theme" && (
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Theme Presets</h2>
              <p className="text-xs text-slate-500 mt-0.5">Choose a preset to apply a complete color scheme instantly</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEME_PRESETS.map(preset => (
                <button key={preset.name} type="button" onClick={() => applyTheme(preset)}
                  className={`relative flex flex-col gap-2 p-4 rounded-2xl border transition-all text-left hover:scale-105 ${
                    form.themeName === preset.name ? "border-white/40 bg-white/8" : "border-white/8 bg-slate-900 hover:border-white/20"
                  }`}
                  style={form.themeName === preset.name ? { borderColor: preset.primary + "80", background: preset.primary + "12" } : {}}>
                  {form.themeName === preset.name && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: preset.primary ?? "var(--gym-primary)" }}>
                      <CheckCheck className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {preset.name === "custom" ? (
                      <div className="w-6 h-6 rounded-md shadow" style={{ background: "linear-gradient(135deg, #f97316, #8b5cf6, #3b82f6, #22c55e)" }} />
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-md shadow" style={{ background: preset.primary }} />
                        <div className="w-6 h-6 rounded-md shadow" style={{ background: preset.accent }} />
                        <div className="w-6 h-6 rounded-md shadow" style={{ background: preset.sidebar }} />
                      </>
                    )}
                  </div>
                  <p className="text-xs font-medium text-white">{preset.label}</p>
                  {preset.name === "custom" && (
                    <p className="text-xs text-slate-500">Pick your own colors →</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Colors */}
        {section === "colors" && (
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white">Color Customization</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {([
                { k: "primaryColor", label: "Primary Color" },
                { k: "secondaryColor", label: "Background Color" },
                { k: "accentColor", label: "Accent Color" },
                { k: "sidebarColor", label: "Sidebar Color" },
                { k: "buttonColor", label: "Button Color" },
                { k: "cardColor", label: "Card Color" },
              ] as const).map(({ k, label }) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">{label}</label>
                  <div className="flex gap-2 items-center">
                    <label className="relative cursor-pointer">
                      <input type="color" value={(form as any)[k] ?? "#ffffff"}
                        onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                        className="sr-only" />
                      <div className="w-10 h-10 rounded-xl shadow-lg border border-white/10 cursor-pointer transition-transform hover:scale-110"
                        style={{ background: (form as any)[k] ?? "#ffffff" }} />
                    </label>
                    <input type="text" value={(form as any)[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder="#000000"
                      className="flex-1 bg-slate-900 border border-white/8 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-white/20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Typography */}
        {section === "typography" && (
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white">Typography</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Heading Font</label>
                <select value={form.headingFont ?? "Inter"} onChange={setInput("headingFont")}
                  className="w-full bg-slate-900 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="mt-2 text-lg font-bold text-white" style={{ fontFamily: form.headingFont ?? "Inter" }}>
                  The quick brown fox
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Body Font</label>
                <select value={form.bodyFont ?? "Inter"} onChange={setInput("bodyFont")}
                  className="w-full bg-slate-900 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <p className="mt-2 text-sm text-slate-300" style={{ fontFamily: form.bodyFont ?? "Inter" }}>
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Media — file upload */}
        {section === "media" && (
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-white">Media & Assets</h2>
              <p className="text-xs text-slate-500 mt-0.5">Upload images from your device or drag and drop. Max 5 MB per file.</p>
            </div>
            <div className="space-y-5">
              <ImageUploader
                label="Gym Logo"
                hint="Recommended: 200×200px square PNG"
                value={form.logoUrl}
                onChange={url => setForm(f => ({ ...f, logoUrl: url || null }))}
              />
              <ImageUploader
                label="Hero Banner"
                hint="Recommended: 1920×400px"
                value={form.bannerUrl}
                onChange={url => setForm(f => ({ ...f, bannerUrl: url || null }))}
              />
              <ImageUploader
                label="Thumbnail"
                hint="Recommended: 800×600px"
                value={form.thumbnailUrl}
                onChange={url => setForm(f => ({ ...f, thumbnailUrl: url || null }))}
              />
            </div>
          </div>
        )}

        {/* Contact */}
        {section === "contact" && (
          <div className="bg-slate-800 border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { k: "address", label: "Address", placeholder: "123 Fitness St, City" },
                { k: "phone", label: "Phone", placeholder: "+1 (555) 000-0000" },
                { k: "email", label: "Email", placeholder: "info@mygym.com" },
                { k: "website", label: "Website", placeholder: "https://mygym.com" },
              ] as const).map(({ k, label, placeholder }) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
                  <input type="text" value={(form as any)[k] ?? ""} onChange={setInput(k)} placeholder={placeholder}
                    className="w-full bg-slate-900 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
                </div>
              ))}
            </div>
          </div>
        )}

        {updateMutation.error && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">
            {(updateMutation.error as Error).message}
          </div>
        )}

        <button type="submit" disabled={updateMutation.isPending}
          className="flex items-center gap-2 disabled:opacity-50 active:scale-95 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "var(--gym-primary)", boxShadow: "0 4px 14px var(--gym-primary-20)" }}>
          {saved ? <CheckCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {updateMutation.isPending ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
