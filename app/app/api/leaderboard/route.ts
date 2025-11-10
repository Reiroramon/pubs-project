import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";      // ⬅ prevent prerender
export const revalidate = 20;

export async function GET() {
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
  const key = process.env.NEXT_PUBLIC_BASESCAN_API_KEY!;

  const url = `https://api.basescan.org/api?module=logs&action=getLogs&address=${contract}&apikey=${key}`;

  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();

  const counts: Record<string, number> = {};

  for (const log of j?.result || []) {
    // ✅ safety check to avoid undefined errors
    if (!log.topics || log.topics.length < 2) continue;

    // ✅ extract wallet address safely
    const wallet = "0x" + log.topics[1].slice(26);
    if (!wallet || wallet.length !== 42) continue;

    counts[wallet] = (counts[wallet] || 0) + 1;
  }

  const rows = Object.entries(counts)
    .map(([wallet, score]) => ({ wallet, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return NextResponse.json(rows);
}
