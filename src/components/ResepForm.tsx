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

const CHIPS = [
  "ada ayam sama tempe", "ada telur doang", "ada ikan & kangkung",
  "cara bikin brownies hemat", "masakan buat bekal anak", "lauk simple 15 menit",
];

const REACTIONS: Reaction[] = ["❤️", "👍", "😋", "🔖"];

const STORAGE_KEY = "bundacerdas_chat_v2";
const HISTORY_KEY = "bundacerdas_history_v2";
const SAVED_KEY = "bundacerdas_saved_v1";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function nowTime() {
  return new Date().toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" });
}

// ── Suara notifikasi WA (Web Audio API) ────────────────────────────────────
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const times = [0, 0.1, 0.2];
    times.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880 + i * 220;
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.12);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.13);
    });
  } catch { /* browser mungkin block autoplay */ }
}

function playSendSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  } catch { /* ignore */ }
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function msgToHistory(msg: Message): ChatMessage | null {
  if (msg.type === "out") return { role: "user", content: msg.text };
  if (msg.type === "in") return { role: "assistant", content: msg.text };
  if (msg.type === "resep") return { role: "assistant", content: `[Resep: ${msg.resep.nama}]` };
  return null;
}

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMessages(msgs: Message[]) {
  try {
    // Simpan max 100 pesan terakhir supaya localStorage tidak penuh
    const toSave = msgs.filter(m => m.type !== "typing").slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* storage full — skip */ }
}

function loadSaved(): Resep[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSaved(list: Resep[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ResepForm() {
  const initMsgs = (): Message[] => {
    if (typeof window === "undefined") return [];
    const stored = loadMessages();
    if (stored.length > 0) return stored;
    return [{
      id: uid(),
      type: "in",
      text: "Halo Bunda! 👋 Mau masak apa hari ini?\nCeritain aja — mau tanya resep, punya bahan apa, atau minta ide masakan, aku siap bantu 😊",
      time: nowTime(),
      status: "read",
    }];
  };

  const [messages, setMessages] = useState<Message[]>(initMsgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [savedResep, setSavedResep] = useState<Resep[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const swipeStartX = useRef<number>(0);

  // Hydrate from localStorage setelah mount (avoid SSR mismatch)
  useEffect(() => {
    const stored = loadMessages();
    if (stored.length > 0) setMessages(stored);
    setSavedResep(loadSaved());
  }, []);

  // Persist setiap kali messages berubah
  useEffect(() => {
    saveMessages(messages);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build conversation history untuk multi-turn
  const buildHistory = useCallback((): ChatMessage[] => {
    return messages
      .filter(m => m.type !== "typing")
      .map(msgToHistory)
      .filter(Boolean) as ChatMessage[];
  }, [messages]);

  async function kirim(pesanOverride?: string) {
    const pesan = (pesanOverride ?? input).trim();
    if (!pesan || loading) return;

    setInput("");
    setLoading(true);
    vibrate(10);
    playSendSound();

    const msgId = uid();
    const time = nowTime();

    // Pesan user muncul dengan status "sending"
    setMessages(prev => [
      ...prev,
      { id: msgId, type: "out", text: pesan, time, status: "sending" as const },
    ]);

    // Setelah 300ms centang jadi "sent", lalu "read" sebelum typing muncul
    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === msgId && m.type === "out" ? { ...m, status: "sent" as const } : m
      ));
    }, 300);

    setTimeout(() => {
      setMessages(prev => [
        ...prev.map(m =>
          m.id === msgId && m.type === "out" ? { ...m, status: "read" as const } : m
        ),
        { id: uid(), type: "typing" },
      ]);
    }, 800);

    try {
      const history = buildHistory();
      // Tambah pesan user ke history sebelum kirim
      const fullHistory: ChatMessage[] = [
        ...history,
        { role: "user", content: pesan },
      ];

      const res = await fetch("/api/resep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const t = nowTime();

      if (data.type === "resep" && Array.isArray(data.resep)) {
        // Stagger resep cards — muncul satu per satu seperti WA
        const resepList = data.resep as Resep[];

        setMessages(prev => prev.filter(m => m.type !== "typing"));

        for (let i = 0; i < resepList.length; i++) {
          await new Promise(r => setTimeout(r, i === 0 ? 400 : 600));
          const isLast = i === resepList.length - 1;
          setMessages(prev => [
            ...prev,
            { id: uid(), type: "resep", resep: resepList[i], time: t },
          ]);
          playNotifSound();
          vibrate(20);
          if (isLast) {
            await new Promise(r => setTimeout(r, 500));
            setMessages(prev => [
              ...prev,
              { id: uid(), type: "in", text: "Mau tanya yang lain? Ketik aja ya Bunda 😊", time: t, status: "read" as const },
            ]);
            playNotifSound();
          }
        }
      } else {
        await new Promise(r => setTimeout(r, 400));
        setMessages(prev => [
          ...prev.filter(m => m.type !== "typing"),
          {
            id: uid(),
            type: "in",
            text: data.text ?? "Maaf, aku kurang ngerti. Coba tanya lagi ya Bunda 😊",
            time: t,
            status: "read" as const,
          },
        ]);
        playNotifSound();
        vibrate(20);
      }
    } catch (err: unknown) {
      const t = nowTime();
      const errMsg = err instanceof Error ? err.message : "Gagal";
      setMessages(prev => [
        ...prev.filter(m => m.type !== "typing"),
        {
          id: uid(),
          type: "in",
          text: errMsg.includes("harian") ? errMsg : "Aduh, gagal nih Bunda 😅 Coba lagi ya!",
          time: t,
          status: "read" as const,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function addReaction(id: string, emoji: Reaction) {
    setMessages(prev => prev.map(m =>
      m.id === id && m.type === "resep" ? { ...m, reaction: emoji } : m
    ));
    setReactionTarget(null);
    vibrate(15);
  }

  function saveResep(resep: Resep) {
    setSavedResep(prev => {
      const exists = prev.some(r => r.nama === resep.nama);
      if (exists) return prev;
      const updated = [resep, ...prev];
      saveSaved(updated);
      return updated;
    });
    vibrate([10, 50, 20]);
  }

  function hapusRiwayat() {
    const welcome: Message = {
      id: uid(), type: "in",
      text: "Chat dihapus. Mau mulai dari awal? Ceritain aja bahan yang ada di dapur 😊",
      time: nowTime(), status: "read",
    };
    setMessages([welcome]);
    localStorage.removeItem(HISTORY_KEY);
  }

  // Swipe to reply (touch)
  function onTouchStart(id: string, e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeId(id);
  }
  function onTouchEnd(id: string, e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - swipeStartX.current;
    if (dx > 60) {
      // swipe kanan → reply
      const msg = messages.find(m => m.id === id);
      if (msg && (msg.type === "in" || msg.type === "resep")) {
        const label = msg.type === "resep" ? `resep ${msg.resep.nama}` : msg.text.slice(0, 40);
        setInput(`Re: ${label} — `);
        inputRef.current?.focus();
        vibrate(20);
      }
    }
    setSwipeId(null);
  }

  return (
    <div className="flex flex-col rounded-3xl overflow-hidden"
      style={{ background: "#e5ddd5", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c5b9ae' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")", minHeight: 480 }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: "#075e54" }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: "#25d366" }}>🍳</div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2" style={{ background: loading ? "#ffd700" : "#25d366", borderColor: "#075e54" }} />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">BundaCerdas</p>
            <p className="text-xs" style={{ color: "#b2dfdb" }}>
              {loading ? "sedang mengetik..." : "online"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSaved(!showSaved)}
            className="text-xs px-2 py-1 rounded-full flex items-center gap-1"
            style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
            🔖 {savedResep.length > 0 && <span>{savedResep.length}</span>}
          </button>
          <button onClick={hapusRiwayat}
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
            🗑
          </button>
        </div>
      </div>

      {/* ── Panel Resep Tersimpan ── */}
      {showSaved && (
        <div className="flex-shrink-0 overflow-y-auto" style={{ maxHeight: 220, background: "#fff", borderBottom: "1px solid #eee" }}>
          {savedResep.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#999" }}>Belum ada resep tersimpan. Tekan 💾 pada resep untuk menyimpan.</p>
          ) : (
            <div className="p-2 space-y-2">
              {savedResep.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "#f0f8f5", border: "1px solid #d4eee5" }}>
                  <span style={{ color: "#075e54", fontWeight: 600 }}>🍳 {r.nama}</span>
                  <span style={{ color: "#888" }}>⏱ {r.estimasi_waktu}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2"
        style={{ height: 380, maxHeight: 380 }}>
        {messages.map((msg) => {

          // Typing indicator
          if (msg.type === "typing") {
            return (
              <div key={msg.id} className="self-start">
                <div className="rounded-2xl rounded-bl-sm px-3 py-2.5" style={{ background: "white" }}>
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((j) => (
                      <span key={j} className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block animate-bounce"
                        style={{ animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // Pesan keluar (user)
          if (msg.type === "out") {
            const isSwipe = swipeId === msg.id;
            return (
              <div key={msg.id} className="self-end max-w-[80%]"
                style={{ transform: isSwipe ? "translateX(-8px)" : "none", transition: "transform 0.15s" }}>
                <div className="rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed"
                  style={{ background: "#dcf8c6", color: "#111" }}>
                  {msg.text}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-xs" style={{ color: "#888" }}>{msg.time}</span>
                    <span style={{ fontSize: 13, color: msg.status === "read" ? "#53bdeb" : "#aaa" }}>
                      {msg.status === "sending" ? "✓" : "✓✓"}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // Pesan masuk (chat biasa)
          if (msg.type === "in") {
            const isSwipe = swipeId === msg.id;
            return (
              <div key={msg.id} className="self-start max-w-[82%]"
                style={{ transform: isSwipe ? "translateX(8px)" : "none", transition: "transform 0.15s" }}
                onTouchStart={e => onTouchStart(msg.id, e)}
                onTouchEnd={e => onTouchEnd(msg.id, e)}>
                <div className="rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-line"
                  style={{ background: "white", color: "#111" }}>
                  {msg.text}
                  <div className="text-right text-xs mt-1" style={{ color: "#aaa" }}>{msg.time}</div>
                </div>
              </div>
            );
          }

          // Kartu resep
          if (msg.type === "resep") {
            const r = msg.resep;
            const isSwipe = swipeId === msg.id;
            return (
              <div key={msg.id} className="self-start max-w-[92%] relative"
                style={{ transform: isSwipe ? "translateX(8px)" : "none", transition: "transform 0.15s" }}
                onTouchStart={e => onTouchStart(msg.id, e)}
                onTouchEnd={e => onTouchEnd(msg.id, e)}>

                {/* Reaction picker */}
                {reactionTarget === msg.id && (
                  <div className="absolute -top-9 left-2 flex gap-1 px-2 py-1 rounded-full shadow z-10"
                    style={{ background: "white", border: "1px solid #eee" }}>
                    {REACTIONS.map(emoji => (
                      <button key={emoji} onClick={() => addReaction(msg.id, emoji)}
                        className="text-lg hover:scale-125 transition-transform">{emoji}</button>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl rounded-bl-sm overflow-hidden text-sm" style={{ background: "white" }}>
                  {/* Header resep */}
                  <div className="px-3 py-2 font-semibold text-white flex items-center justify-between"
                    style={{ background: "#075e54" }}>
                    <span>🍳 {r.nama}</span>
                    <div className="flex items-center gap-1">
                      {/* Tombol simpan */}
                      <button onClick={() => saveResep(r)}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                        title="Simpan resep">
                        💾
                      </button>
                      {/* Tombol reaction */}
                      <button onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                        title="Beri reaksi">
                        {msg.reaction ?? "☺"}
                      </button>
                    </div>
                  </div>

                  <div className="px-3 py-2 space-y-2">
                    {/* Meta info */}
                    <div className="flex gap-3 text-xs flex-wrap" style={{ color: "#666" }}>
                      <span>⏱ {r.estimasi_waktu}</span>
                      <span>💰 {r.estimasi_biaya}</span>
                      {r.porsi && <span>🍽 {r.porsi}</span>}
                    </div>

                    {/* Bahan */}
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#888" }}>BAHAN</p>
                      <ul className="space-y-0.5">
                        {r.bahan.map((b, j) => (
                          <li key={j} className="text-xs flex gap-1.5" style={{ color: "#333" }}>
                            <span style={{ color: "#25d366", fontWeight: 700 }}>•</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Cara masak */}
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#888" }}>CARA MASAK</p>
                      <ol className="space-y-1">
                        {r.langkah.map((l, j) => (
                          <li key={j} className="text-xs flex gap-2" style={{ color: "#333" }}>
                            <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white font-medium"
                              style={{ background: "#075e54", fontSize: 9, marginTop: 1 }}>
                              {j + 1}
                            </span>
                            {l}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Tips */}
                    {r.tips && (
                      <div className="text-xs px-2 py-1.5 rounded-r-lg"
                        style={{ background: "#f0f8f5", borderLeft: "3px solid #25d366", color: "#444" }}>
                        💡 {r.tips}
                      </div>
                    )}

                    <div className="text-right text-xs" style={{ color: "#aaa" }}>{msg.time}</div>
                  </div>
                </div>

                {/* Reaction badge */}
                {msg.reaction && (
                  <div className="absolute -bottom-2 right-2 text-sm px-1.5 py-0.5 rounded-full shadow"
                    style={{ background: "white", border: "1px solid #eee" }}>
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
      <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto flex-nowrap"
        style={{ background: "rgba(255,255,255,0.5)" }}>
        {CHIPS.map((c) => (
          <button key={c} onClick={() => kirim(c)} disabled={loading}
            className="flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50"
            style={{ background: "white", borderColor: "#ccc", color: "#333", whiteSpace: "nowrap" }}>
            {c}
          </button>
        ))}
      </div>

      {/* ── Input area ── */}
      <div className="px-3 py-2" style={{ background: "#f0f0f0" }}>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") kirim(); }}
            placeholder="Ketik pesan..."
            disabled={loading}
            className="flex-1 rounded-full px-4 py-2 text-sm outline-none"
            style={{ background: "white", border: "none", fontFamily: "inherit" }}
          />
          <button onClick={() => kirim()} disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: loading || !input.trim() ? "#aaa" : "#075e54",
              color: "white", border: "none",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s, transform 0.1s",
              transform: !loading && input.trim() ? "scale(1.05)" : "scale(1)",
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
