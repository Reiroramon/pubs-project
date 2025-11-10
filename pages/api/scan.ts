import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY!;
const RPC = process.env.RPC_URL_BASE!;
const HONEYPOT_API = process.env.HONEYPOT_API || "https://honeypot.is/api/v2/IsHoneypot";

const STABLECOINS = (process.env.STABLECOINS_LIST || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = (req.query.token as string)?.toLowerCase();
  if (!token) return res.status(400).json({ error: "token required" });

  // 1) Blok token resmi / stablecoin
  if (STABLECOINS.includes(token)) {
    return res.json({ excluded: true, reason: "stablecoin_or_official" });
  }

  // 2) Cek verified di BaseScan
  let verified = false;
  try {
    const r = await fetch(
      `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${token}&apikey=${BASESCAN_API_KEY}`
    );
    const j = await r.json();
    if (j?.result?.[0]?.SourceCode) verified = true;
  } catch {}

  if (verified) {
    return res.json({ excluded: true, reason: "verified_contract" });
  }

  // 3) Scan honeypot
  let honeypot = null;
  try {
    const h = await fetch(`${HONEYPOT_API}?chain=base&token=${token}`);
    honeypot = await h.json();
  } catch {
    honeypot = { error: "honeypot_scan_failed" };
  }

  // 4) Metadata
  const provider = new ethers.JsonRpcProvider(RPC);
  const erc20 = new ethers.Contract(
    token,
    [
      "function symbol() view returns (string)",
      "function name() view returns (string)",
      "function decimals() view returns (uint8)",
    ],
    provider
  );

  let meta = { symbol: "", name: "", decimals: 18 };
  try {
    meta.symbol = await erc20.symbol();
    meta.name = await erc20.name();
    meta.decimals = await erc20.decimals();
  } catch {}

  return res.json({
    token,
    verified,
    honeypot,
    meta,
    status: "scan_complete",
  });
}
