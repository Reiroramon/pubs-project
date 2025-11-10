"use client";

import { useEffect, useMemo, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
const GOPLUS_KEY = process.env.NEXT_PUBLIC_GOPLUS_KEY;

// ABI final
const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256 feeWei, uint8 decimals_)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];

// Block stablecoins/official tokens on Base
const BLOCKED_TOKENS_BASE = new Set(
  [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC native
    "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // cbETH
  ].map(a => a.toLowerCase())
);

// utilities
const fmtUsd = (n?: number | null): string =>
  n == null || Number.isNaN(n) ? "-" : n >= 1 ? n.toFixed(2) : n.toFixed(6);

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

async function fetchDexscreenerPrice(addr: string) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
    const j = await r.json();
    const p = j?.pairs?.[0];
    return {
      price: p?.priceUsd ? Number(p.priceUsd) : null,
      logo: p?.info?.imageUrl || null,
      liquidity: p?.liquidity?.usd ? Number(p.liquidity.usd) : null,
    };
  } catch {
    return { price: null, logo: null, liquidity: null };
  }
}

async function scanWithGoPlus(addr: string) {
  if (!GOPLUS_KEY) return { ok: false, reason: "Scan skipped (no GoPlus key)" };

  try {
    const url = `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${addr}`;
    const r = await fetch(url);
    const j = await r.json();
    const rec = j?.result?.[addr.toLowerCase()];
    if (!rec) return { ok: false, reason: "No record" };

    const honeypot = rec.is_honeypot === "1" || rec.transfer_pausable === "1";
    const mint = rec.can_mint === "1";
    const hidden = rec.hidden_owner === "1";
    const risky = honeypot || mint || hidden;

    return {
      ok: !risky,
      reason: risky
        ? `Risk: ${[
            honeypot && "honeypot",
            mint && "mintable",
            hidden && "hiddenOwner",
          ].filter(Boolean).join(", ")}`
        : "Looks OK",
    };
  } catch {
    return { ok: false, reason: "Scan failed" };
  }
}

export default function HomePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [selectedAddr, setSelectedAddr] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    sdk.actions.ready();
    (async () => {
      try {
        const accounts = await (sdk as any).wallet.ethProvider.request({ method: "eth_requestAccounts" });
        setWallet(accounts?.[0] ?? null);
      } catch {
        setWallet(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!wallet || !ALCHEMY_KEY) return;
    (async () => {
      setStatus("Loading tokens...");
      try {
        const r = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances", params: [wallet] }),
        });
        const j = await r.json();
        const balances = j?.result?.tokenBalances || [];
        const slice = balances.slice(0, 50);

        const out: any[] = [];
        for (const b of slice) {
          const addr = b.contractAddress;
          const meta = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "alchemy_getTokenMetadata",
              params: [addr],
            }),
          }).then(r => r.json());
          const m = meta?.result || {};
          const dec = Number(m.decimals ?? 18);
          const bal = b.tokenBalance || "0";

          const { price, logo, liquidity } = await fetchDexscreenerPrice(addr);

          // HANYA TAMPILKAN TOKEN DENGAN LIQUIDITY < $30k = kemungkinan scam lebih tinggi
          if (!liquidity || liquidity < 30000) {
            out.push({
              address: addr,
              symbol: m.symbol || "TOKEN",
              name: m.name || m.symbol || "Token",
              decimals: dec,
              balance: bal,
              priceUsd: price,
              liquidity,
              logo,
              blocked: BLOCKED_TOKENS_BASE.has(addr.toLowerCase()),
            });
          }
        }

        setTokens(out);
        setStatus("");
      } catch {
        setTokens([]);
        setStatus("Failed load token list");
      }
    })();
  }, [wallet]);

  const selected = useMemo(
    () => tokens.find(t => t.address.toLowerCase() === selectedAddr.toLowerCase()),
    [tokens, selectedAddr]
  );

  const handleBurn = async () => {
    try {
      if (!selected) return setStatus("Select a token first");
      if (selected.blocked) return setStatus("Blocked token (stable/official)");

      // gunakan seluruh balance user
      const amountWei = ethers.parseUnits(
        ethers.formatUnits(selected.balance, selected.decimals),
        selected.decimals
      );

      setStatus("Preparing tx...");
      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const [feeWei] = await contract.quoteErc20Fee(selected.address, amountWei);

      const scan = await scanWithGoPlus(selected.address);
      const scanSummary = JSON.stringify({ auto: true, result: scan.reason, ts: Date.now() });

      const tx = await contract.burnToken(selected.address, amountWei, scanSummary, { value: feeWei });

      setStatus("Confirming...");
      const rc = await tx.wait();
      setTxHash(rc?.hash || tx.hash);
      setStatus("✅ Burned successfully");
    } catch (e: any) {
      setStatus("❌ " + (e?.message || "Error"));
    }
  };

  return (
    <div className="min-h-screen bg-[#1f1f1f] text-white p-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-4 text-sm opacity-70">Wallet: {wallet ? short(wallet) : "-"}</div>

        <div className="text-xl font-semibold mb-3">Select Token to Burn</div>

        <div className="border border-[#333] rounded-xl max-h-[420px] overflow-y-auto divide-y divide-[#333]">
          {tokens.map(t => {
            const selectedMark = selectedAddr.toLowerCase() === t.address.toLowerCase();
            const bal = Number(ethers.formatUnits(t.balance, t.decimals));
            return (
              <button
                key={t.address}
                disabled={t.blocked}
                onClick={() => setSelectedAddr(t.address)}
                className={`w-full flex items-center px-3 py-3 gap-3 text-left ${t.blocked ? "opacity-40 cursor-not-allowed" : "hover:bg-[#2a2a2a]"}`}
              >
                <img src={t.logo || "https://www.coingecko.com/coins/images/1/small/bitcoin.png"} className="w-8 h-8 rounded-full" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs opacity-60">{t.symbol} • {bal.toLocaleString()} • {short(t.address)}</div>
                </div>
                <div className="text-sm opacity-75">${fmtUsd(t.priceUsd)}</div>
                <div className={`w-5 h-5 rounded border ${selectedMark ? "bg-green-500 border-green-500" : "border-gray-600"}`} />
              </button>
            );
          })}
        </div>

        <button onClick={handleBurn} className="mt-4 w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 font-semibold">
          🔥 Burn Selected Token
        </button>

        {status && <div className="mt-3 text-sm opacity-80">{status}</div>}
        {txHash && (
          <a href={`https://basescan.org/tx/${txHash}`} target="_blank" className="text-sm text-green-400 underline mt-2 inline-block">
            View on BaseScan
          </a>
        )}
      </div>
    </div>
  );
}
