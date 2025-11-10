import { NextResponse } from "next/server";

export const revalidate = 20;

export async function GET() {
  const contract = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
  const key = process.env.NEXT_PUBLIC_BASESCAN_API_KEY!;

  const url = `https://api.basescan.org/api?module=logs&action=getLogs&address=${contract}&apikey=${key}`;

  const r = await fetch(url);
  const j = await r.json();

  const counts: Record<string, number> = {};

  for (const log of j.result || []) {
    const wallet = "0x" + log.topics[1].slice(26);
    counts[wallet] = (counts[wallet] || 0) + 1;
  }

  const rows = Object.entries(counts)
    .map(([wallet, score]) => ({ wallet, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return NextResponse.json(rows);
}
