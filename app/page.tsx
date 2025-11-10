"use client";

import { useEffect, useMemo, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ethers } from "ethers";

// ======= CONFIG =======
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!; // isi di .env.local / Vercel
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY;            // opsional (untuk list token wallet)
const GOPLUS_KEY  = process.env.NEXT_PUBLIC_GOPLUS_KEY;             // opsional (untuk auto-scan)

// ABI final
const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256 feeWei, uint8 decimals_)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];

// ======= DATA: stablecoins/official di Base (blok) =======
const BLOCKED_TOKENS_BASE = new Set<string>(
  [
    // USDC native (Base)
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    // USDbC (bridged)
    "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    // DAI (Base)
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    // cbETH (contoh resmi)
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
  ].map((a) => a.toLowerCase())
);

// ======= Types =======
type TokenRow = {
  address: string;
  symbol: string;
  name: string;
  balance: string;         // raw balance (wei)
  decimals: number;
  priceUsd?: number | null;
  logo?: string | null;
  blocked?: boolean;       // stable/resmi -> disabled
};

// ======= Helper =======
const fmtUsd = (n?: number | null) =>
  n == null ? "-" : (n >= 1 ? n.toFixed(2) : n.toFixed(4));

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

async function fetchDexscreenerPrice(tokenAddr: string) {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddr}`
    );
    const j = await r.json();
    const first = j?.pairs?.[0];
    const price = first?.priceUsd ? Number(first.priceUsd) : null;
    // coba ambil logo coingecko dari pair info jika ada
    const logo =
      first?.info?.imageUrl ||
      null;
    return { price, logo };
  } catch {
    return { price: null, logo: null };
  }
}

async function scanWithGoPlus(tokenAddr: string) {
  if (!GOPLUS_KEY) {
    return { ok: false, reason: "Scan skipped (no GOPLUS key)" };
  }
  try {
    const url = `https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${tokenAddr}`;
    const r = await fetch(url, { headers: { "Referer": "https://warpcast.com" } });
    const j = await r.json();
    const rec = j?.result?.[tokenAddr.toLowerCase()];
    if (!rec) return { ok: false, reason: "No record" };
    // contoh flags sederhana
    const isHoneypot = rec.is_honeypot === "1" || rec.transfer_pausable === "1";
    const canMint    = rec.can_mint    === "1";
    const hiddenOwner= rec.hidden_owner === "1";
    const bad = isHoneypot || canMint || hiddenOwner;
    return {
      ok: !bad,
      reason: bad
        ? `Risk: ${[
            isHoneypot && "honeypot",
            canMint && "canMint",
            hiddenOwner && "hiddenOwner",
          ]
            .filter(Boolean)
            .join(", ")}`
        : "Looks OK by GoPlus",
    };
  } catch {
    return { ok: false, reason: "Scan error" };
  }
}

// ======= MAIN PAGE =======
export default function HomePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedAddr, setSelectedAddr] = useState<string>("");
  const [amount, setAmount] = useState<string>(""); // amount in human units
  const [status, setStatus] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  // ready + get wallet
  useEffect(() => {
    sdk.actions.ready(); // panggil secepat UI siap

    (async () => {
      try {
        const accounts: string[] = await (sdk as any).wallet.ethProvider.request({
          method: "eth_requestAccounts",
        });
        setWallet(accounts?.[0] ?? null);
      } catch {
        setWallet(null);
      }
    })();
  }, []);

  // load tokens from wallet (opsional Alchemy)
  useEffect(() => {
    if (!wallet) return;
    (async () => {
      setLoadingList(true);
      try {
        let result: TokenRow[] = [];

        if (ALCHEMY_KEY) {
          // Alchemy getTokenBalances
          const body = {
            id: 1,
            jsonrpc: "2.0",
            method: "alchemy_getTokenBalances",
            params: [wallet],
          };
          const r = await fetch(
            `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
            { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
          );
          const j = await r.json();
          const balances: { contractAddress: string; tokenBalance: string }[] =
            j?.result?.tokenBalances ?? [];

          // ambil metadata untuk decimals/symbol/name
          const metaReq = {
            id: 2,
            jsonrpc: "2.0",
            method: "alchemy_getTokenMetadata",
            params: [] as any[],
          };

          // batasi 50 token agar ringan
          const slice = balances.slice(0, 50);

          const rows: TokenRow[] = [];
          for (const tb of slice) {
            const addr = tb.contractAddress;
            // metadata satu2 supaya aman di browser
            const mr = await fetch(
              `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  ...metaReq,
                  params: [addr],
                }),
              }
            );
            const mj = await mr.json();
            const md = mj?.result || {};
            const decimals = Number(md.decimals ?? 18);
            const symbol = md.symbol || "TOKEN";
            const name = md.name || symbol;

            // price + logo via Dexscreener
            const { price, logo } = await fetchDexscreenerPrice(addr);

            rows.push({
              address: addr,
              symbol,
              name,
              balance: tb.tokenBalance || "0",
              decimals,
              priceUsd: price,
              logo: logo ?? null,
              blocked: BLOCKED_TOKENS_BASE.has(addr.toLowerCase()),
            });
          }
          result = rows;
        } else {
          // tanpa Alchemy -> kosong (user pilih manual)
          result = [];
        }

        setTokens(result);
      } catch {
        setTokens([]);
      } finally {
        setLoadingList(false);
      }
    })();
  }, [wallet]);

  const selectedToken = useMemo(
    () => tokens.find((t) => t.address.toLowerCase() === selectedAddr.toLowerCase()),
    [tokens, selectedAddr]
  );

  // Auto Scan
  const handleAutoScan = async () => {
    if (!selectedAddr) {
      setStatus("⚠️ Pilih token dulu.");
      return;
    }
    if (BLOCKED_TOKENS_BASE.has(selectedAddr.toLowerCase())) {
      setStatus("⛔ Token resmi/stable diblok agar tidak salah bakar.");
      return;
    }

    setStatus("🔍 Auto-scan in progress…");
    const res = await scanWithGoPlus(selectedAddr);
    if (res.ok) {
      setStatus("✅ Scan OK: " + res.reason);
    } else {
      setStatus("⚠️ Scan info: " + res.reason);
    }
  };

  // Burn
  const handleBurn = async () => {
    try {
      if (!selectedAddr) {
        setStatus("⚠️ Pilih token dulu.");
        return;
      }
      if (!amount || Number(amount) <= 0) {
        setStatus("⚠️ Masukkan jumlah > 0");
        return;
      }
      if (BLOCKED_TOKENS_BASE.has(selectedAddr.toLowerCase())) {
        setStatus("⛔ Token resmi/stable tidak bisa dibakar.");
        return;
      }

      setStatus("🔥 Menyiapkan transaksi…");

      // cast ke EIP-1193 agar tidak bentrok tipe
      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      const decimals = selectedToken?.decimals ?? 18;
      const amountWei = ethers.parseUnits(amount, decimals);

      const [feeWei] = await contract.quoteErc20Fee(selectedAddr, amountWei);

      const scanSummary = JSON.stringify({
        source: "miniapp",
        automatedScan: !!GOPLUS_KEY,
        ts: Date.now(),
      });

      const tx = await contract.burnToken(selectedAddr, amountWei, scanSummary, {
        value: feeWei,
      });

      setStatus("⏳ Menunggu konfirmasi…");
      const receipt = await tx.wait();
      setStatus("✅ Burn sukses!");
      setTxHash(receipt?.hash ?? tx.hash);
    } catch (e: any) {
      setStatus("❌ Error: " + (e?.message || "Unknown"));
    }
  };

  // ========== UI (abu-abu + hijau lembut) ==========
  return (
    <div className="min-h-screen bg-[#1e1e1e] text-[#f5f5f5]">
      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm">
            {wallet ? `Wallet: ${short(wallet)}` : "Wallet: -"}
          </div>
          <div className="text-lg font-semibold">PUBS BURN</div>
        </div>

        {/* Selector bar */}
        <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-[#262626] border border-[#2f2f2f]">
          <div className="text-sm">{selectedAddr ? "1 selected" : "0 selected"}</div>
          <div className="flex items-center gap-4 text-sm">
            <button
              className="hover:underline"
              onClick={() => {
                // contoh: pilih 1st (maks 1 untuk burn aman)
                if (tokens.length) setSelectedAddr(tokens[0].address);
              }}
            >
              Select 1
            </button>
            <button className="hover:underline" onClick={() => setSelectedAddr("")}>
              Clear
            </button>
          </div>
        </div>

        {/* List */}
        <div className="mt-3 rounded-xl overflow-hidden border border-[#2f2f2f]">
          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#2a2a2a]">
            {loadingList && (
              <div className="p-4 text-sm text-gray-400">Loading tokens…</div>
            )}

            {!loadingList && tokens.length === 0 && (
              <div className="p-4 text-sm text-gray-400">
                Tidak ada list. Isi manual di bawah atau set <code>NEXT_PUBLIC_ALCHEMY_KEY</code>.
              </div>
            )}

            {tokens.map((t) => {
              const isSelected = selectedAddr.toLowerCase() === t.address.toLowerCase();
              const disabled = !!t.blocked;
              const balHuman = (() => {
                try {
                  return Number(ethers.formatUnits(t.balance, t.decimals));
                } catch {
                  return 0;
                }
              })();

              return (
                <button
                  key={t.address}
                  onClick={() => !disabled && setSelectedAddr(t.address)}
                  className={`w-full text-left px-3 py-3 flex items-center gap-3 ${
                    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[#2a2a2a]"
                  }`}
                >
                  <img
                    src={t.logo || "https://www.coingecko.com/coins/images/1/thumb/bitcoin.png"}
                    alt={t.symbol}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-gray-400">
                      {t.symbol} • {balHuman.toLocaleString()} • {short(t.address)}
                    </div>
                  </div>
                  <div className="text-sm mr-3">
                    ${fmtUsd(t.priceUsd)}
                  </div>
                  <div
                    className={`w-6 h-6 rounded-md border ${
                      isSelected ? "bg-[#2ecc71] border-[#2ecc71]" : "border-[#3a3a3a]"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual input (fallback & kontrol jumlah) */}
        <div className="mt-4 space-y-2">
          <input
            value={selectedAddr}
            onChange={(e) => setSelectedAddr(e.target.value)}
            placeholder="Token address (manual)"
            className="w-full px-3 py-2 rounded-lg bg-[#262626] border border-[#2f2f2f] outline-none"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount to burn"
            className="w-full px-3 py-2 rounded-lg bg-[#262626] border border-[#2f2f2f] outline-none"
          />
        </div>

        {/* Actions */}
        <div className="mt-4 space-y-2">
          <button
            onClick={handleAutoScan}
            className="w-full py-3 rounded-lg bg-[#2e7dd7] hover:opacity-90 font-semibold"
          >
            🔍 Auto Scan (Anti Rugcheck)
          </button>
          <button
            onClick={handleBurn}
            className="w-full py-3 rounded-lg bg-[#e03a3a] hover:opacity-90 font-semibold"
          >
            🔥 Burn Now
          </button>
          {status && (
            <div className="text-sm mt-2 text-gray-300">{status}</div>
          )}
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline text-[#7ddc9c]"
            >
              View on BaseScan
            </a>
          )}
        </div>

        <div className="text-[11px] text-gray-500 mt-6">
          Stablecoin & token resmi otomatis diblok dari pemilihan. Gunakan manual jika scan kurang akurat.
        </div>
      </div>
    </div>
  );
}
