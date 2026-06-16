import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  QrCode, UserCheck, Search, Users, Clock, Camera,
  CheckCircle, XCircle, Zap, X, SwitchCamera, AlertTriangle, RefreshCw,
} from "lucide-react";
import jsQR from "jsqr";
import { api } from "../lib/api.js";
import { formatDateTime } from "../lib/utils.js";

interface Member {
  id: number; name: string; email: string; phone: string;
  status: string; membershipType: string; membershipExpiry: string;
  qrToken: string | null;
}
interface Attendance {
  id: number; memberId: number; memberName: string;
  checkInAt: string; checkOutAt: string | null;
}
type ScanResult = { success: true; member: Member } | { success: false; error: string } | null;
type Tab = "scanner" | "lookup" | "today";

function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 300;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.3 : 0.45));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (success ? 0.3 : 0.45));
    if (success) {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1320;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.45);
    }
  } catch { }
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-orange-500", "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500"];
  return (
    <div className={`${sz} ${colors[name.charCodeAt(0) % colors.length]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function StaffPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("scanner");
  const [scanning, setScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [search, setSearch] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const lastScanRef = useRef<number>(0);
  const processingRef = useRef(false);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members", ""],
    queryFn: () => api.get("/members"),
  });

  const { data: todayAttendance = [] } = useQuery<Attendance[]>({
    queryKey: ["attendance-today"],
    queryFn: () => api.get("/attendance?today=1"),
    refetchInterval: 15_000,
  });

  const checkInMutation = useMutation({
    mutationFn: (memberId: number) => api.post("/attendance", { memberId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const processQRToken = useCallback((token: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    const member = members.find(m => m.qrToken === token || `MEMBER-${m.id}` === token);
    if (!member) {
      playBeep(false);
      setScanResult({ success: false, error: `No member found for QR: "${token.slice(0, 30)}"` });
      setTimeout(() => { processingRef.current = false; setScanResult(null); }, 3000);
      return;
    }
    if (member.status !== "active") {
      playBeep(false);
      setScanResult({ success: false, error: `"${member.name}" is ${member.status}. Check-in denied.` });
      setTimeout(() => { processingRef.current = false; setScanResult(null); }, 3500);
      return;
    }
    checkInMutation.mutate(member.id, {
      onSuccess: () => {
        playBeep(true);
        setScanResult({ success: true, member });
        setTimeout(() => { processingRef.current = false; setScanResult(null); }, 4000);
      },
      onError: (err: Error) => {
        playBeep(false);
        setScanResult({ success: false, error: err.message });
        setTimeout(() => { processingRef.current = false; setScanResult(null); }, 3000);
      },
    });
  }, [members, checkInMutation]);

  async function startScanner(mode: "environment" | "user" = facingMode) {
    stopScanner();
    setCameraError(null);
    setScanResult(null);
    setCameraReady(false);
    processingRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API not available. Please open this page in Chrome, Firefox, or Safari over a secure connection (https).");
      return;
    }

    try {
      setFacingMode(mode);
      let stream: MediaStream | null = null;

      // Try with ideal facingMode first
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback: try any available camera with no constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      // Wait for the video to have enough metadata to play
      await new Promise<void>((resolve) => {
        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          video.play()
            .then(() => setCameraReady(true))
            .catch(() => {
              // Autoplay blocked — still try to show the stream
              setCameraReady(true);
            });
          resolve();
        };

        // If metadata already loaded
        if (video.readyState >= 1) {
          done();
          return;
        }

        video.addEventListener("loadedmetadata", done, { once: true });
        video.addEventListener("canplay", done, { once: true });

        // Safety timeout: proceed after 2.5s regardless
        setTimeout(done, 2500);
      });

      setScanning(true);
    } catch (err: any) {
      const name = err?.name ?? "";
      let msg = "Camera access failed. Please check permissions and try again.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "Camera permission was denied. Click the camera icon in your browser's address bar, allow access, and try again.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        msg = "No camera detected. Please connect a camera and try again.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        msg = "Camera is in use by another application. Close it and try again.";
      } else if (name === "SecurityError") {
        msg = "Camera blocked by security policy. Make sure you're on a secure (https) connection.";
      } else if (err?.message) {
        msg = err.message;
      }
      setCameraError(msg);
    }
  }

  function stopScanner() {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
    }
    setScanning(false);
    setCameraReady(false);
  }

  async function switchCamera() {
    const newMode = facingMode === "environment" ? "user" : "environment";
    await startScanner(newMode);
  }

  useEffect(() => {
    if (!scanning) return;

    let frameId = 0;

    function scanFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const now = Date.now();
          if (now - lastScanRef.current > 400 && !processingRef.current) {
            lastScanRef.current = now;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "attemptBoth",
            });
            if (code?.data) {
              processQRToken(code.data);
            }
          }
        }
      }
      frameId = requestAnimationFrame(scanFrame);
      animRef.current = frameId;
    }

    frameId = requestAnimationFrame(scanFrame);
    animRef.current = frameId;
    return () => { cancelAnimationFrame(frameId); };
  }, [scanning, processQRToken]);

  useEffect(() => () => stopScanner(), []);

  const filteredMembers = members.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayCheckins = todayAttendance.filter(a => new Date(a.checkInAt) >= todayStart);

  const tabs = [
    { key: "scanner" as Tab, label: "QR Scanner", icon: QrCode },
    { key: "lookup" as Tab, label: "Lookup", icon: Search },
    { key: "today" as Tab, label: `Today (${todayCheckins.length})`, icon: Clock },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Staff Panel</h1>
        <p className="text-slate-400 text-sm mt-0.5">QR attendance scanner · member lookup · daily log</p>
      </div>

      <div className="flex gap-1 bg-slate-800 border border-white/5 rounded-xl p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key); if (key !== "scanner") stopScanner(); }}
            className={`flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? "text-white shadow" : "text-slate-400 hover:text-white hover:bg-white/5"}`} style={tab === key ? { background: "var(--gym-primary)" } : {}}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* QR SCANNER */}
      {tab === "scanner" && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden border border-white/5" style={{ minHeight: 320 }}>
            {/* Video always rendered to avoid remounting issues */}
            <video
              ref={videoRef}
              className={`w-full object-cover transition-opacity duration-300 ${scanning ? "opacity-100" : "opacity-0 absolute"}`}
              style={{ height: 320 }}
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            {scanning && (
              <>
                {/* Scanner overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-56">
                    {[
                      "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl",
                      "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl",
                      "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl",
                      "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl",
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-8 h-8 ${cls}`} style={{ borderColor: "var(--gym-primary)" }} />
                    ))}
                    <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 animate-pulse" style={{ background: `linear-gradient(to right, transparent, var(--gym-primary), transparent)` }} />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--gym-primary)" }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute top-3 right-3 flex gap-2">
                  <button onClick={switchCamera}
                    className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-xl hover:bg-blue-500/70 transition-colors border border-white/10"
                    title="Switch camera">
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                  <button onClick={stopScanner}
                    className="bg-black/60 backdrop-blur-sm text-white p-2 rounded-xl hover:bg-red-500/70 transition-colors border border-white/10">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="absolute bottom-3 inset-x-0 flex justify-center">
                  <span className="text-xs text-white/70 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    {facingMode === "environment" ? "📷 Rear camera" : "🤳 Front camera"} · Aim at member's QR code
                  </span>
                </div>
              </>
            )}

            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
                {cameraError ? (
                  <>
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="text-white font-semibold text-base">Camera Access Problem</p>
                      <p className="text-slate-400 text-sm mt-2 leading-relaxed">{cameraError}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                      <button onClick={() => startScanner("environment")}
                        className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                        style={{ background: "var(--gym-primary)" }}>
                        <Camera className="w-4 h-4" /> Retry
                      </button>
                      <button onClick={() => startScanner("user")}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-sm transition-all">
                        <SwitchCamera className="w-4 h-4" /> Front Camera
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <div className="w-24 h-24 rounded-3xl flex items-center justify-center border-2"
                        style={{ background: "var(--gym-primary-10)", borderColor: "var(--gym-primary-20)" }}>
                        <QrCode className="w-12 h-12" style={{ color: "var(--gym-primary)" }} />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "var(--gym-primary)", boxShadow: "0 4px 12px var(--gym-primary-20)" }}>
                        <Camera className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-lg">QR Attendance Scanner</p>
                      <p className="text-slate-500 text-sm mt-1">Instantly check in members by scanning their QR code</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startScanner("environment")}
                        className="flex items-center gap-2 text-white px-7 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                        style={{ background: "var(--gym-primary)" }}>
                        <Camera className="w-4 h-4" /> Start Camera
                      </button>
                      <button onClick={() => startScanner("user")}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-3 rounded-xl text-sm transition-all"
                        title="Use front camera">
                        <SwitchCamera className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">Allow camera access when your browser asks</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scan Result */}
          {scanResult && (
            <div className={`rounded-2xl p-5 border transition-all animate-in slide-in-from-bottom-2 duration-300 ${
              scanResult.success
                ? "bg-emerald-500/8 border-emerald-500/30"
                : "bg-red-500/8 border-red-500/30"
            }`}>
              {scanResult.success ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-500/15 rounded-2xl flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-emerald-400 text-lg leading-tight">Check-in Successful!</p>
                    <p className="text-white font-semibold mt-0.5">{scanResult.member.name}</p>
                    <p className="text-slate-400 text-xs mt-0.5 capitalize">
                      {scanResult.member.membershipType} · {scanResult.member.email}
                    </p>
                  </div>
                  <Avatar name={scanResult.member.name} size="lg" />
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-red-500/15 rounded-2xl flex items-center justify-center flex-shrink-0 border border-red-500/30">
                    <XCircle className="w-7 h-7 text-red-400" />
                  </div>
                  <div>
                    <p className="font-bold text-red-400 text-base">Check-in Denied</p>
                    <p className="text-slate-300 text-sm mt-0.5">{scanResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MEMBER LOOKUP */}
      {tab === "lookup" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or phone..."
              className="w-full bg-slate-800 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/25" />
          </div>

          <div className="space-y-2">
            {filteredMembers.slice(0, 25).map(m => {
              const alreadyIn = todayCheckins.some(a => a.memberId === m.id);
              return (
                <div key={m.id}
                  className="flex items-center gap-3 bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 hover:border-white/10 transition-all">
                  <Avatar name={m.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                      m.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}>{m.status}</span>
                    {alreadyIn ? (
                      <span className="flex items-center gap-1 text-xs bg-blue-500/15 text-blue-400 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle className="w-3 h-3" /> In
                      </span>
                    ) : (
                      <button
                        disabled={checkInMutation.isPending || m.status !== "active"}
                        onClick={() => {
                          if (m.status !== "active") return;
                          checkInMutation.mutate(m.id, {
                            onSuccess: () => { playBeep(true); setScanResult({ success: true, member: m }); setTab("scanner"); },
                          });
                        }}
                        className="flex items-center gap-1.5 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
                        style={{ background: "var(--gym-primary)" }}>
                        <Zap className="w-3 h-3" /> Check In
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No members found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TODAY'S CHECK-INS */}
      {tab === "today" && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl px-5 py-4 border"
            style={{ background: "var(--gym-primary-10)", borderColor: "var(--gym-primary-20)" }}>
            <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ background: "var(--gym-primary)" }} />
            <p className="text-xs uppercase tracking-wider font-semibold pl-2" style={{ color: "var(--gym-primary)" }}>Today's Attendance</p>
            <p className="text-4xl font-bold text-white mt-1 pl-2 tabular-nums">{todayCheckins.length}</p>
            <p className="text-xs text-slate-400 mt-0.5 pl-2">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>

          {todayCheckins.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No check-ins recorded today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...todayCheckins].reverse().map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-slate-800 border border-white/5 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{a.memberName}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(a.checkInAt)}</p>
                  </div>
                  {a.checkOutAt && (
                    <span className="text-xs text-slate-500">out {formatDateTime(a.checkOutAt)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
