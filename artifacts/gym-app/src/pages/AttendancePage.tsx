import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, UserCheck, Camera, CameraOff, QrCode, Users, Clock } from "lucide-react";
import jsQR from "jsqr";
import { api } from "../lib/api.js";
import { formatDateTime } from "../lib/utils.js";

interface Attendance {
  id: number; memberId: number; memberName: string;
  checkInAt: string; checkOutAt: string | null; notes: string | null;
}
interface Member { id: number; name: string; status: string; qrToken: string | null; }

type CheckInMode = "manual" | "qr";

export default function AttendancePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<CheckInMode>("manual");
  const [memberId, setMemberId] = useState("");
  const [notes, setNotes] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedMember, setScannedMember] = useState<Member | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const { data: records = [], isLoading } = useQuery<Attendance[]>({
    queryKey: ["attendance"],
    queryFn: () => api.get("/attendance"),
    refetchInterval: 30_000,
  });
  const { data: todayRecords = [] } = useQuery<Attendance[]>({
    queryKey: ["attendance-today"],
    queryFn: () => api.get("/attendance/today"),
    refetchInterval: 15_000,
  });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members-all"],
    queryFn: () => api.get("/members"),
  });

  const checkInMutation = useMutation({
    mutationFn: (data: { memberId: number; notes: string | null }) => api.post("/attendance", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-today"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      closeModal();
    },
  });

  function closeModal() {
    stopCamera();
    setShowModal(false);
    setMemberId("");
    setNotes("");
    setScanResult(null);
    setScanError(null);
    setScannedMember(null);
    setMode("manual");
  }

  async function startCamera() {
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
      scanFrame();
    } catch {
      setScanError("Camera access denied. Please allow camera permission.");
    }
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      const token = code.data;
      setScanResult(token);
      stopCamera();
      const found = members.find(m => m.qrToken === token || token.includes(`-${m.id}`));
      if (found) {
        setScannedMember(found);
        setMemberId(found.id.toString());
      } else {
        setScanError("QR code not recognized. Member not found.");
      }
    } else {
      rafRef.current = requestAnimationFrame(scanFrame);
    }
  }

  useEffect(() => { return () => { stopCamera(); }; }, []);

  const filtered = records.filter(r =>
    !search || r.memberName.toLowerCase().includes(search.toLowerCase())
  );

  const activeMembers = members.filter(m => m.status === "active");

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            <span className="font-semibold" style={{ color: "var(--gym-primary)" }}>{todayRecords.length}</span> check-ins today
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: "var(--gym-primary)", boxShadow: `0 4px 14px var(--gym-primary-20)` }}>
          <Plus className="w-4 h-4" /> Check In
        </button>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4 text-center">
          <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2"
            style={{ background: "var(--gym-primary-10)" }}>
            <UserCheck className="w-4 h-4" style={{ color: "var(--gym-primary)" }} />
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{todayRecords.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Today</p>
        </div>
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4 text-center">
          <div className="w-8 h-8 bg-blue-500/15 rounded-full flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{records.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">All Time</p>
        </div>
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4 text-center">
          <div className="w-8 h-8 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{activeMembers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active</p>
        </div>
      </div>

      {/* Today's Chips */}
      {todayRecords.length > 0 && (
        <div className="bg-slate-800 border border-white/5 rounded-2xl p-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Today's Check-ins</h2>
          <div className="flex flex-wrap gap-2">
            {todayRecords.map(r => (
              <div key={r.id} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300 font-medium">{r.memberName}</span>
                <span className="text-xs text-emerald-600">{new Date(r.checkInAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by member name..."
          className="w-full bg-slate-800 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-white/20" />
      </div>

      {/* Records Table */}
      <div className="bg-slate-800 border border-white/5 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserCheck className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium text-left">Member</th>
                  <th className="px-4 py-3 font-medium text-left">Check-in</th>
                  <th className="px-4 py-3 font-medium text-left hidden sm:table-cell">Check-out</th>
                  <th className="px-4 py-3 font-medium text-left hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(r => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "var(--gym-primary-10)" }}>
                          <UserCheck className="w-3.5 h-3.5" style={{ color: "var(--gym-primary)" }} />
                        </div>
                        <span className="font-medium text-white">{r.memberName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs">{formatDateTime(r.checkInAt)}</td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-xs">
                      {r.checkOutAt ? (
                        <span className="text-slate-400">{formatDateTime(r.checkOutAt)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs hidden md:table-cell">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Check-in Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="text-base font-bold text-white">Check In Member</h2>
              <button onClick={closeModal} className="text-slate-500 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-1 m-4 bg-slate-800 rounded-xl p-1">
              <button onClick={() => { setMode("manual"); stopCamera(); setScanResult(null); setScannedMember(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mode === "manual" ? "text-white" : "text-slate-400 hover:text-white"}`}
                style={mode === "manual" ? { background: "var(--gym-primary)" } : {}}>
                <Users className="w-4 h-4" /> Manual
              </button>
              <button onClick={() => setMode("qr")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mode === "qr" ? "text-white" : "text-slate-400 hover:text-white"}`}
                style={mode === "qr" ? { background: "var(--gym-primary)" } : {}}>
                <QrCode className="w-4 h-4" /> QR Scan
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {mode === "manual" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Select Member</label>
                    <select value={memberId} onChange={e => setMemberId(e.target.value)} required
                      className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-white/20">
                      <option value="">Choose an active member...</option>
                      {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  {!scanning && !scannedMember && (
                    <button onClick={startCamera}
                      className="w-full flex flex-col items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 border border-dashed border-white/15 hover:border-white/30 rounded-xl py-8 transition-all group">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
                        style={{ background: "var(--gym-primary-10)" }}>
                        <Camera className="w-7 h-7" style={{ color: "var(--gym-primary)" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">Open Camera</p>
                        <p className="text-xs text-slate-500 mt-0.5">Point at member's QR code</p>
                      </div>
                    </button>
                  )}

                  {scanning && (
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      <video ref={videoRef} className="w-full h-48 object-cover" playsInline muted />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border-2 rounded-xl opacity-70" style={{ borderColor: "var(--gym-primary)" }} />
                      </div>
                      <button onClick={stopCamera} className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-lg">
                        <CameraOff className="w-4 h-4" />
                      </button>
                      <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">Scanning...</p>
                    </div>
                  )}

                  {scannedMember && (
                    <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 text-center">
                      <UserCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">{scannedMember.name}</p>
                      <p className="text-xs text-emerald-400 mt-0.5">Ready to check in</p>
                    </div>
                  )}

                  {scanError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <p className="text-xs text-red-400">{scanError}</p>
                      <button onClick={() => { setScanError(null); setScanResult(null); }} className="text-xs text-slate-400 underline mt-1">Try again</button>
                    </div>
                  )}
                </div>
              )}

              {(mode === "manual" || scannedMember) && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Notes (optional)</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..."
                    className="w-full bg-slate-800 border border-white/8 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-white/20" />
                </div>
              )}

              {checkInMutation.error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">{(checkInMutation.error as Error).message}</div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-xl py-2.5 text-sm font-medium transition-all">Cancel</button>
                <button
                  onClick={() => {
                    if (!memberId) return;
                    checkInMutation.mutate({ memberId: Number(memberId), notes: notes || null });
                  }}
                  disabled={checkInMutation.isPending || !memberId}
                  className="flex-1 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "var(--gym-primary)", boxShadow: `0 4px 16px var(--gym-primary-20)` }}
                >
                  {checkInMutation.isPending ? "Checking in..." : "Check In"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
