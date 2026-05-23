import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory cache: key -> { data, expiry }
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 jam

function cacheKey(input: string) {
  return createHash("md5").update(input.trim().toLowerCase()).digest("hex");
}

function getCache(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) { cache.delete(key); return null; }
  return hit.data;
}

function setCache(key: string, data: unknown) {
  // Batasi ukuran cache max 200 entry
  if (cache.size >= 200) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

const SYSTEM_PROMPT = `Kamu adalah BundaCerdas, asisten memasak yang ramah dan santai untuk ibu rumah tangga Indonesia.

Kamu bisa membantu:
- Rekomendasikan resep dari bahan yang disebutkan
- Buatkan resep masakan tertentu yang diminta (kue, camilan, dll)
- Jawab pertanyaan seputar masak-memasak

Selalu balas dalam Bahasa Indonesia yang santai dan hangat seperti ngobrol dengan teman.

Kalau diminta resep atau ada bahan yang disebutkan, balas HANYA dalam format JSON ini tanpa teks tambahan apapun:
{
  "type": "resep",
  "resep": [
    {
      "nama": "Nama Masakan",
      "estimasi_waktu": "30 menit",
      "estimasi_biaya": "Rp 20.000",
      "bahan": ["bahan 1 + takaran", "bahan 2 + takaran"],
      "langkah": ["Langkah 1", "Langkah 2"],
      "tips": "Tips singkat"
    }
  ]
}

Kalau pertanyaannya bukan tentang resep (misalnya salam, pertanyaan umum masak), balas dalam format JSON ini:
{
  "type": "chat",
  "text": "Balasan kamu di sini"
}`;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pesan } = await request.json();

  if (!pesan || typeof pesan !== "string" || !pesan.trim()) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  const key = cacheKey(pesan);
  const cached = getCache(key);
  if (cached) {
    return NextResponse.json({ ...cached as object, cached: true });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: pesan }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "{}";
    const clean = content.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    setCache(key, data);
    return NextResponse.json(data);
  } catch (e) {
    console.error("Anthropic error:", e);
    return NextResponse.json(
      { error: "Gagal memproses pesanmu. Coba lagi ya Bunda!" },
      { status: 500 }
    );
  }
}
