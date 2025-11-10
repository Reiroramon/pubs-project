import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // ✅ Prevent prerender entirely
export const revalidate = 0; // ✅ Disable caching (safest)

export async function GET() {
  try {
    const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
    const key = process.env.NEXT_PUBLIC_BASESCAN_API_KEY!;

    const url = `https://api.basescan.org/api?module=logs&action=getLogs&address=${contract}&apikey=${key}`;

    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();

    const counts: Record<string, number> = {};

    for (const log of j?.result || []) {
      // ✅ Avoid undefined logs / topics
      if (!log?.topics || log.topics.length < 2) continue;

      // ✅ Extract wallet safely
      const topic = log.topics[1];
      if (!topic || topic.length < 66) continue;

      const wallet = "0x" + topic.slice(26);
      if (!wallet || wallet.length !== 42) continue;

      counts[wallet] = (counts[wallet] || 0) + 1;
    }

    const rows = Object.entries(counts)
      .map(([wallet, score]) => ({ wallet, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: "Leaderboard fetch failed", details: String(err) }, { status: 500 });
  }
}
