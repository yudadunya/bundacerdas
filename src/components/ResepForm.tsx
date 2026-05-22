"use client";

import { useState } from "react";

type Resep = {
  nama: string;
  estimasi_waktu: string;
  estimasi_biaya: string;
  bahan: string[];
  langkah: string[];
  tips: string;
};

const BAHAN_CEPAT = [
  "ayam", "tempe", "tahu", "telur", "kangkung",
  "bayam", "wortel", "kentang", "bawang", "cabai",
  "ikan", "udang", "toge", "sawi", "tomat",
];

export default function ResepForm() {
  const [input, setInput] = useState("");
  const [bahan, setBahan] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [resepList, setResepList] = useState<Resep[]>([]);
  const [error, setError] = useState("");

  function tambahBahan(b: string) {
    const cleaned = b.trim().toLowerCase();
    if (!cleaned || bahan.includes(cleaned)) return;
    setBahan((prev) => [...prev, cleaned]);
    setInput("");
  }

  function hapusBahan(b: string) {
    setBahan((prev) => prev.filter((x) => x !== b));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      tambahBahan(input);
    }
  }

  async function cariResep() {
    if (bahan.length === 0) return;
    setLoading(true);
    setError("");
    setResepList([]);
    try {
      const res = await fetch("/api/resep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bahan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
      setResepList(data.resep);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi ya Bunda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Input bahan */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-3">
          🥬 Bahan apa yang ada di dapur?
        </h3>

        {/* Bahan terpilih */}
        {bahan.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {bahan.map((b) => (
              <span
                key={b}
                onClick={() => hapusBahan(b)}
                className="inline-flex items-center gap-1 bg-brand-500 text-white text-sm
                           font-medium px-3 py-1 rounded-full cursor-pointer hover:bg-brand-600
                           transition-colors"
              >
                {b}
                <span className="text-brand-200 hover:text-white ml-0.5">×</span>
              </span>
            ))}
          </div>
        )}

        {/* Text input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik bahan, tekan Enter..."
            className="flex-1 border-2 border-brand-200 focus:border-brand-400 outline-none
                       rounded-xl px-4 py-2.5 text-sm transition-colors"
          />
          <button
            onClick={() => tambahBahan(input)}
            disabled={!input.trim()}
            className="btn-primary px-4 py-2.5 text-sm"
          >
            Tambah
          </button>
        </div>

        {/* Quick add */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Pilih cepat:</p>
          <div className="flex flex-wrap gap-1.5">
            {BAHAN_CEPAT.filter((b) => !bahan.includes(b)).map((b) => (
              <button
                key={b}
                onClick={() => tambahBahan(b)}
                className="tag text-xs"
              >
                + {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={cariResep}
        disabled={bahan.length === 0 || loading}
        className="btn-primary w-full text-base"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Lagi nyari resep...
          </span>
        ) : (
          "✨ Cariin Resep!"
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="card border-red-200 bg-red-50 text-red-600 text-sm">
          😅 {error}
        </div>
      )}

      {/* Hasil resep */}
      {resepList.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-600 text-sm">
            🎉 Ini rekomendasi resepnya, Bunda!
          </h3>
          {resepList.map((resep, i) => (
            <ResepCard key={i} resep={resep} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResepCard({ resep, index }: { resep: Resep; index: number }) {
  const [buka, setBuka] = useState(index === 0);

  return (
    <div
      className="card border-brand-200 overflow-hidden"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <button
        onClick={() => setBuka((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h4 className="font-display text-lg text-brand-700">{resep.nama}</h4>
          <div className="flex gap-3 mt-1">
            <span className="text-xs text-gray-500">⏱️ {resep.estimasi_waktu}</span>
            <span className="text-xs text-gray-500">💰 {resep.estimasi_biaya}</span>
          </div>
        </div>
        <span className="text-brand-400 text-xl ml-4">{buka ? "▲" : "▼"}</span>
      </button>

      {/* Detail */}
      {buka && (
        <div className="mt-4 space-y-4 border-t border-brand-100 pt-4">
          {/* Bahan */}
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">🛒 Bahan-bahan:</p>
            <ul className="space-y-1">
              {resep.bahan.map((b, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-brand-400">•</span> {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Langkah */}
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">👩‍🍳 Cara masak:</p>
            <ol className="space-y-2">
              {resep.langkah.map((l, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-3">
                  <span className="w-5 h-5 bg-brand-100 text-brand-600 rounded-full flex items-center
                                   justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {l}
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          {resep.tips && (
            <div className="bg-sage-50 border border-sage-200 rounded-2xl px-4 py-3">
              <p className="text-sm text-sage-700">
                <span className="font-semibold">💡 Tips:</span> {resep.tips}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
