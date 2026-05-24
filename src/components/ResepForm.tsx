"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Resep = {
  nama: string;
  estimasi_waktu: string;
  estimasi_biaya: string;
  porsi?: string;
  bahan: string[];
  langkah: string[];
  tips: string;
};

type Reaction = "❤️" | "👍" | "😋" | "🔖";

type Message =
  | { id: string; type: "in" | "out"; text: string; time: string; status?: "sending" | "sent" | "read" }
  | { id: string; type: "resep"; resep: Resep; time: string; reaction?: Reaction }
  | { id: string; type: "typing" };

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
};

const CHIPS = [
  "ada ayam sama tempe", "ada telur doang", "ada ikan & kangkung",
  "cara bikin brownies hemat", "masakan buat bekal anak", "lauk simple 15 menit",
];

const REACTIONS: Reaction[] = ["❤️", "👍", "😋", "🔖"];

const STORAGE_KEY = "bundacerdas_chat_v2";
const SAVED_KEY = "bundacerdas_saved_v1";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function nowTime() {
  return new Date().toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" });
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.1, 0.2].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880 + i * 220;
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.12);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.13);
    });
  } catch { /* ignore */ }
}

function playSendSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.09);
  } catch { /* ignore */ }
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

function msgToHistory(msg: Message): ChatMessage | null {
  if (msg.type === "out") return { role: "user", content: msg.text };
  if (msg.type === "in") return { role: "assistant", content: msg.text };
  if (msg.type === "resep") return { role: "assistant", content: `[Resep: ${msg.resep.nama}]` };
  return null;
}

function loadMessages(): Message[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function saveMessages(msgs: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.filter(m => m.type !== "typing").slice(-100))); }
  catch { /* ignore */ }
}

function loadSaved(): Resep[] {
  try { const r = localStorage.getItem(SAVED_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function saveSaved(list: Resep[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export default function ResepForm({ userName = "Bunda", userAvatar, onLogout }: Props) {
  const initMsgs = (): Message[] => {
    if (typeof window === "undefined") return [];
    const stored = loadMessages();
    if (stored.length > 0) return stored;
    return [{ id: uid(), type: "in", text: `Halo ${userName}! 👋 Mau masak apa hari ini?\nCeritain aja — mau tanya resep, punya bahan apa, atau minta ide masakan, aku siap bantu 😊`, time: nowTime(), status: "read" }];
  };

  const [messages, setMessages] = useState<Message[]>(initMsgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [savedResep, setSavedResep] = useState<Resep[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const swipeStartX = useRef<number>(0);
  const swipeId = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadMessages();
    if (stored.length > 0) setMessages(stored);
    setSavedResep(loadSaved());
  }, []);

  useEffect(() => {
    saveMessages(messages);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildHistory = useCallback((): ChatMessage[] => {
    return messages.filter(m => m.type !== "typing").map(msgToHistory).filter(Boolean) as ChatMessage[];
  }, [messages]);

  async function kirim(pesanOverride?: string) {
    const pesan = (pesanOverride ?? input).trim();
    if (!pesan || loading) return;
    setInput(""); setLoading(true);
    vibrate(10); playSendSound();

    const msgId = uid();
    const time = nowTime();
    setMessages(prev => [...prev, { id: msgId, type: "out", text: pesan, time, status: "sending" }]);

    setTimeout(() => setMessages(prev => prev.map(m => m.id === msgId && m.type === "out" ? { ...m, status: "sent" as const } : m)), 300);
    setTimeout(() => setMessages(prev => [
      ...prev.map(m => m.id === msgId && m.type === "out" ? { ...m, status: "read" as const } : m),
      { id: uid(), type: "typing" },
    ]), 800);

    try {
      const fullHistory: ChatMessage[] = [...buildHistory(), { role: "user", content: pesan }];
      const res = await fetch("/api/resep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const t = nowTime();

      if (data.type === "resep" && Array.isArray(data.resep)) {
        setMessages(prev => prev.filter(m => m.type !== "typing"));
        for (let i = 0; i < (data.resep as Resep[]).length; i++) {
          await new Promise(r => setTimeout(r, i === 0 ? 400 : 600));
          setMessages(prev => [...prev, { id: uid(), type: "resep", resep: (data.resep as Resep[])[i], time: t }]);
          playNotifSound(); vibrate(20);
          if (i === (data.resep as Resep[]).length - 1) {
            await new Promise(r => setTimeout(r, 500));
            setMessages(prev => [...prev, { id: uid(), type: "in", text: "Mau tanya yang lain? Ketik aja ya Bunda 😊", time: t, status: "read" }]);
            playNotifSound();
          }
        }
      } else {
        await new Promise(r => setTimeout(r, 400));
        setMessages(prev => [...prev.filter(m => m.type !== "typing"), { id: uid(), type: "in", text: data.text ?? "Maaf, aku kurang ngerti. Coba tanya lagi ya Bunda 😊", time: t, status: "read" }]);
        playNotifSound(); vibrate(20);
      }
    } catch (err: unknown) {
      const t = nowTime();
      const msg = err instanceof Error ? err.message : "Gagal";
      setMessages(prev => [...prev.filter(m => m.type !== "typing"), { id: uid(), type: "in", text: msg.includes("harian") ? msg : "Aduh, gagal nih Bunda 😅 Coba lagi ya!", time: t, status: "read" }]);
    } finally { setLoading(false); }
  }

  function addReaction(id: string, emoji: Reaction) {
    setMessages(prev => prev.map(m => m.id === id && m.type === "resep" ? { ...m, reaction: emoji } : m));
    setReactionTarget(null); vibrate(15);
  }

  function saveResep(resep: Resep) {
    setSavedResep(prev => {
      if (prev.some(r => r.nama === resep.nama)) return prev;
      const updated = [resep, ...prev]; saveSaved(updated); return updated;
    });
    vibrate([10, 50, 20]);
  }

  function hapusRiwayat() {
    setMessages([{ id: uid(), type: "in", text: "Chat dihapus. Mau mulai dari awal? 😊", time: nowTime(), status: "read" }]);
    setShowMenu(false);
  }

  function onTouchStart(id: string, e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX; swipeId.current = id;
  }
  function onTouchEnd(id: string, e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (dx > 60) {
      const msg = messages.find(m => m.id === id);
      if (msg && (msg.type === "in" || msg.type === "resep")) {
        const label = msg.type === "resep" ? `resep ${msg.resep.nama}` : msg.text.slice(0, 40);
        setInput(`Re: ${label} — `); inputRef.current?.focus(); vibrate(20);
      }
    }
    swipeId.current = null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>

      {/* ── Header WA ── */}
      <div style={{ background: "#075e54", flexShrink: 0, paddingTop: "env(safe-area-inset-top)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🍳</div>
              <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: loading ? "#ffd700" : "#25d366", border: "2px solid #075e54" }} />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "white", fontSize: 15, margin: 0, lineHeight: 1.3 }}>BundaCerdas</p>
              <p style={{ fontSize: 12, color: "#b2dfdb", margin: 0 }}>{loading ? "sedang mengetik..." : "online"}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setShowSaved(!showSaved)}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: "4px 10px", color: "white", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              🔖 {savedResep.length > 0 && <span>{savedResep.length}</span>}
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowMenu(!showMenu)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "white", fontSize: 16, cursor: "pointer" }}>⋮</button>
              {showMenu && (
                <div style={{ position: "absolute", right: 0, top: 36, background: "white", borderRadius: 8, boxShadow: "0 2px 12px rgba(0,0,0,0.15)", zIndex: 100, minWidth: 160, overflow: "hidden" }}>
                  <button onClick={hapusRiwayat} style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left", fontSize: 14, color: "#333", background: "none", border: "none", cursor: "pointer" }}>🗑 Hapus riwayat chat</button>
                  {onLogout && <button onClick={onLogout} style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left", fontSize: 14, color: "#e53e3e", background: "none", border: "none", cursor: "pointer" }}>🚪 Keluar ({userName})</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel Resep Tersimpan ── */}
      {showSaved && (
        <div style={{ background: "white", borderBottom: "1px solid #eee", maxHeight: 200, overflowY: "auto", flexShrink: 0 }}>
          {savedResep.length === 0
            ? <p style={{ textAlign: "center", fontSize: 12, color: "#999", padding: 16 }}>Belum ada resep tersimpan. Tekan 💾 pada resep.</p>
            : <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {savedResep.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "#f0f8f5", border: "1px solid #d4eee5", fontSize: 12 }}>
                  <span style={{ color: "#075e54", fontWeight: 600 }}>🍳 {r.nama}</span>
                  <span style={{ color: "#888" }}>⏱ {r.estimasi_waktu}</span>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* ── Messages area ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "8px 12px",
        display: "flex", flexDirection: "column", gap: 6,
        background: "#e5ddd5",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c5b9ae' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")",
      }}
        onClick={() => { setReactionTarget(null); setShowMenu(false); }}>

        {messages.map((msg) => {
          if (msg.type === "typing") return (
            <div key={msg.id} style={{ alignSelf: "flex-start" }}>
              <div style={{ background: "white", borderRadius: "18px 18px 18px 4px", padding: "10px 14px" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center", height: 16 }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#aaa", display: "inline-block", animation: "bounce 1s infinite", animationDelay: `${j * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          );

          if (msg.type === "out") return (
            <div key={msg.id} style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
              <div style={{ background: "#dcf8c6", borderRadius: "18px 18px 4px 18px", padding: "8px 12px", fontSize: 14, lineHeight: 1.5, color: "#111" }}>
                {msg.text}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: "#888" }}>{msg.time}</span>
                  <span style={{ fontSize: 13, color: msg.status === "read" ? "#53bdeb" : "#aaa" }}>
                    {msg.status === "sending" ? "✓" : "✓✓"}
                  </span>
                </div>
              </div>
            </div>
          );

          if (msg.type === "in") return (
            <div key={msg.id} style={{ alignSelf: "flex-start", maxWidth: "82%" }}
              onTouchStart={e => onTouchStart(msg.id, e)}
              onTouchEnd={e => onTouchEnd(msg.id, e)}>
              <div style={{ background: "white", borderRadius: "18px 18px 18px 4px", padding: "8px 12px", fontSize: 14, lineHeight: 1.5, color: "#111", whiteSpace: "pre-line" }}>
                {msg.text}
                <div style={{ textAlign: "right", fontSize: 11, color: "#aaa", marginTop: 3 }}>{msg.time}</div>
              </div>
            </div>
          );

          if (msg.type === "resep") {
            const r = msg.resep;
            return (
              <div key={msg.id} style={{ alignSelf: "flex-start", maxWidth: "92%", position: "relative" }}
                onTouchStart={e => onTouchStart(msg.id, e)}
                onTouchEnd={e => onTouchEnd(msg.id, e)}>

                {reactionTarget === msg.id && (
                  <div style={{ position: "absolute", top: -40, left: 8, background: "white", borderRadius: 24, padding: "4px 10px", display: "flex", gap: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.15)", zIndex: 10 }}>
                    {REACTIONS.map(emoji => (
                      <button key={emoji} onClick={() => addReaction(msg.id, emoji)}
                        style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 2 }}>{emoji}</button>
                    ))}
                  </div>
                )}

                <div style={{ background: "white", borderRadius: "18px 18px 18px 4px", overflow: "hidden", fontSize: 13 }}>
                  <div style={{ background: "#075e54", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "white", fontSize: 14 }}>🍳 {r.nama}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveResep(r)}
                        style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 12, padding: "2px 8px", color: "white", fontSize: 12, cursor: "pointer" }}>💾</button>
                      <button onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                        style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 12, padding: "2px 8px", color: "white", fontSize: 12, cursor: "pointer" }}>
                        {msg.reaction ?? "☺"}
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 12, color: "#666", fontSize: 12, flexWrap: "wrap" }}>
                      <span>⏱ {r.estimasi_waktu}</span>
                      <span>💰 {r.estimasi_biaya}</span>
                      {r.porsi && <span>🍽 {r.porsi}</span>}
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#888", margin: "0 0 4px" }}>BAHAN</p>
                      {r.bahan.map((b, j) => (
                        <div key={j} style={{ display: "flex", gap: 6, color: "#333", fontSize: 12, marginBottom: 2 }}>
                          <span style={{ color: "#25d366", fontWeight: 700 }}>•</span>{b}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#888", margin: "0 0 4px" }}>CARA MASAK</p>
                      {r.langkah.map((l, j) => (
                        <div key={j} style={{ display: "flex", gap: 8, color: "#333", fontSize: 12, marginBottom: 4 }}>
                          <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: "50%", background: "#075e54", color: "white", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{j + 1}</span>
                          {l}
                        </div>
                      ))}
                    </div>
                    {r.tips && (
                      <div style={{ background: "#f0f8f5", borderLeft: "3px solid #25d366", borderRadius: "0 6px 6px 0", padding: "6px 10px", fontSize: 12, color: "#444" }}>
                        💡 {r.tips}
                      </div>
                    )}
                    <div style={{ textAlign: "right", fontSize: 11, color: "#aaa" }}>{msg.time}</div>
                  </div>
                </div>

                {msg.reaction && (
                  <div style={{ position: "absolute", bottom: -10, right: 8, background: "white", borderRadius: 12, padding: "1px 6px", fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
                    {msg.reaction}
                  </div>
                )}
              </div>
            );
          }
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick chips ── */}
      <div style={{ background: "rgba(240,240,240,0.95)", padding: "6px 12px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
        {CHIPS.map(c => (
          <button key={c} onClick={() => kirim(c)} disabled={loading}
            style={{ flexShrink: 0, fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "1px solid #ccc", background: "white", color: "#333", whiteSpace: "nowrap", cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
            {c}
          </button>
        ))}
      </div>

      {/* ── Input area ── */}
      <div style={{ background: "#f0f0f0", padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom))", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input ref={inputRef} type="text" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") kirim(); }}
            placeholder="Ketik pesan..."
            disabled={loading}
            style={{ flex: 1, borderRadius: 24, padding: "10px 16px", fontSize: 14, border: "none", outline: "none", background: "white", fontFamily: "inherit" }}
          />
          <button onClick={() => kirim()} disabled={loading || !input.trim()}
            style={{
              width: 42, height: 42, borderRadius: "50%", border: "none",
              background: loading || !input.trim() ? "#aaa" : "#075e54",
              color: "white", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background 0.2s",
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
