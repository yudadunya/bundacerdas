import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  // Auth check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bahan } = await request.json();

  if (!Array.isArray(bahan) || bahan.length === 0) {
    return NextResponse.json({ error: "Bahan tidak boleh kosong" }, { status: 400 });
  }

  const prompt = `Kamu adalah asisten memasak untuk ibu rumah tangga Indonesia.

Bahan yang tersedia: ${bahan.join(", ")}

Berikan 2-3 rekomendasi resep masakan Indonesia yang bisa dibuat dari bahan-bahan tersebut (boleh ditambahkan bumbu dapur umum seperti bawang, garam, minyak, dll).

Balas HANYA dalam format JSON seperti ini, tanpa teks tambahan apapun, tanpa markdown, tanpa backtick:
{
  "resep": [
    {
      "nama": "Nama Masakan",
      "estimasi_waktu": "20 menit",
      "estimasi_biaya": "Rp 15.000",
      "bahan": ["bahan 1 + takarannya", "bahan 2 + takarannya"],
      "langkah": ["Langkah 1", "Langkah 2", "Langkah 3"],
      "tips": "Tips singkat agar masakan lebih enak"
    }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "{}";
    // Strip markdown fences jika ada
    const clean = content.replace(/```json|```/g, "").trim();
    const data = JSON.parse(clean);

    return NextResponse.json(data);
  } catch (e) {
    console.error("Anthropic error:", e);
    return NextResponse.json(
      { error: "Gagal mengambil resep. Coba lagi ya Bunda!" },
      { status: 500 }
    );
  }
}
