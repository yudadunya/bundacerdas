"use client";

import { useState, useEffect, useRef } from "react";

type Resep = {
  nama: string;
  estimasi_waktu: string;
  estimasi_biaya: string;
  bahan: string[];
  langkah: string[];
  tips: string;
};

type Message =
  | { type: "in" | "out"; text: string; time: string }
  | { type: "resep"; resep: Resep; time: string }
  | { type: "typing" };

const CHIPS = [
  "ada ayam sama tempe", "ada telur doang", "ada ikan & kangkung",
  "cara bikin brownies hemat", "masakan buat bekal anak", "lauk simple 15 menit",
];

function nowTime() {
  return new Date().toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" });
}

export default function ResepForm() {
  const [messages, setMessages] = useState<Message[]>([
    {
      type: "in",
      text: "Halo Bunda! 👋 Mau masak apa hari ini?\nCeritain aja — mau tanya resep, punya bahan apa, atau minta ide masakan, aku siap bantu 😊",
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function kirim(pesanOverride?: string) {
    const pesan = (pesanOverride ?? input).trim();
    if (!pesan || loading) return;

    setInput("");
    setLoading(true);

    const time = nowTime();
    setMessages((prev) => [
      ...prev,
      { type: "out", text: pesan, time },
      { type: "typing" },
    ]);

    try {
      const res = await fetch("/api/resep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const t = nowTime();

      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.type !== "typing");

        if (data.type === "resep" && Array.isArray(data.resep)) {
          const resepMessages: Message[] = (data.resep as Resep[]).map((r) => ({
            type: "resep",
            resep: r,
            time: t,
          }));
          return [
            ...withoutTyping,
            ...resepMessages,
            { type: "in", text: "Mau tanya yang lain? Ketik aja ya Bunda 😊", time: t },
          ];
        } else {
          return [
            ...withoutTyping,
            { type: "in", text: data.text ?? "Maaf, aku kurang ngerti. Coba tanya lagi ya Bunda 😊", time: t },
          ];
        }
      });
    } catch {
      const t = nowTime();
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== "typing"),
        { type: "in", text: "Aduh, gagal nih Bunda 😅 Coba lagi ya!", time: t },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col rounded-3xl overflow-hidden"
      style={{
        background: "#e5ddd5",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c5b9ae' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E\")",
        minHeight: 480,
      }}
    >
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2"
        style={{ height: 430, maxHeight: 430 }}
      >
        {messages.map((msg, i) => {
          if (msg.type === "typing") {
            return (
              <div key={i} className="self-start">
                <div className="rounded-2xl rounded-bl-sm px-3 py-2.5" style={{ background: "white" }}>
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block animate-bounce"
                        style={{ animationDelay: `${j * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.type === "out") {
            return (
              <div key={i} className="self-end max-w-[80%]">
                <div className="rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed" style={{ background: "#dcf8c6", color: "#111" }}>
                  {msg.text}
                  <div className="text-right text-xs mt-1" style={{ color: "#888" }}>{msg.time} ✓✓</div>
                </div>
              </div>
            );
          }

          if (msg.type === "in") {
            return (
              <div key={i} className="self-start max-w-[82%]">
                <div className="rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-line" style={{ background: "white", color: "#111" }}>
                  {msg.text}
                  <div className="text-right text-xs mt-1" style={{ color: "#aaa" }}>{msg.time}</div>
                </div>
              </div>
            );
          }

          if (msg.type === "resep") {
            const r = msg.resep;
            return (
              <div key={i} className="self-start max-w-[90%]">
                <div className="rounded-2xl rounded-bl-sm overflow-hidden text-sm" style={{ background: "white" }}>
                  <div className="px-3 py-2 font-semibold text-white" style={{ background: "#075e54" }}>
                    🍳 {r.nama}
                  </div>
                  <div className="px-3 py-2 space-y-2">
                    <div className="flex gap-4 text-xs" style={{ color: "#666" }}>
                      <span>⏱ {r.estimasi_waktu}</span>
                      <span>💰 {r.estimasi_biaya}</span>
                    </div>
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
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#888" }}>CARA MASAK</p>
                      <ol className="space-y-1">
                        {r.langkah.map((l, j) => (
                          <li key={j} className="text-xs flex gap-2" style={{ color: "#333" }}>
                            <span
                              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white font-medium"
                              style={{ background: "#075e54", fontSize: 9, marginTop: 1 }}
                            >
                              {j + 1}
                            </span>
                            {l}
                          </li>
                        ))}
                      </ol>
                    </div>
                    {r.tips && (
                      <div className="text-xs px-2 py-1.5 rounded-r-lg" style={{ background: "#f0f8f5", borderLeft: "3px solid #25d366", color: "#444" }}>
                        💡 {r.tips}
                      </div>
                    )}
                    <div className="text-right text-xs" style={{ color: "#aaa" }}>{msg.time}</div>
                  </div>
                </div>
              </div>
            );
          }
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto flex-nowrap" style={{ background: "rgba(255,255,255,0.5)" }}>
        {CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => kirim(c)}
            disabled={loading}
            className="flex-shrink-0 text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-50"
            style={{ background: "white", borderColor: "#ccc", color: "#333", whiteSpace: "nowrap" }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="px-3 py-2" style={{ background: "#f0f0f0" }}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") kirim(); }}
            placeholder="Ketik pesan... (contoh: cara bikin brownies hemat)"
            disabled={loading}
            className="flex-1 rounded-full px-4 py-2 text-sm outline-none"
            style={{ background: "white", border: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={() => kirim()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: loading || !input.trim() ? "#aaa" : "#075e54",
              color: "white",
              border: "none",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
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
