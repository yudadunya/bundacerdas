import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory cache: key -> { data, expiry }
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 jam

// Rate limit: userId -> { count, resetAt }
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 1000 * 60 * 60 * 24; // 24 jam

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function cacheKey(userId: string, input: string) {
  return createHash("md5")
    .update(userId + input.trim().toLowerCase())
    .digest("hex");
}

function getCache(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiry) { cache.delete(key); return null; }
  return hit.data;
}

function setCache(key: string, data: unknown) {
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
- Ingat konteks percakapan sebelumnya dalam satu sesi

Selalu balas dalam Bahasa Indonesia yang santai dan hangat seperti ngobrol dengan teman.

Kalau diminta resep atau ada bahan yang disebutkan, balas HANYA dalam format JSON ini tanpa teks tambahan apapun:
{
  "type": "resep",
  "resep": [
    {
      "nama": "Nama Masakan",
      "estimasi_waktu": "30 menit",
      "estimasi_biaya": "Rp 20.000",
      "porsi": "2 porsi",
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

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Batas pesan harian tercapai. Coba lagi besok ya Bunda 😊" },
      { status: 429 }
    );
  }

  const body = await request.json();

  // Support both single pesan (legacy) and full history
  let messages: ChatMessage[];
  if (Array.isArray(body.messages)) {
    messages = body.messages;
  } else if (typeof body.pesan === "string") {
    messages = [{ role: "user", content: body.pesan }];
  } else {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content ?? "";
  if (!lastUserMsg.trim()) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
  }

  // Only cache single-turn (no history context)
  const useCache = messages.length === 1;
  const key = cacheKey(user.id, lastUserMsg);
  if (useCache) {
    const cached = getCache(key);
    if (cached) return NextResponse.json({ ...cached as object, cached: true });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages,
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "{}";
    const clean = content.replace(/```json|```/g, "").trim();

    let data: unknown;
    try {
      data = JSON.parse(clean);
    } catch {
      // Fallback: kalau JSON parse gagal, wrap sebagai chat biasa
      data = { type: "chat", text: clean || "Maaf, aku bingung nih Bunda 😅 Coba tanya lagi ya!" };
    }

    if (useCache) setCache(key, data);
    return NextResponse.json(data);
  } catch (e) {
    console.error("Anthropic error:", e);
    return NextResponse.json(
      { error: "Gagal memproses pesanmu. Coba lagi ya Bunda!" },
      { status: 500 }
    );
  }
}
