// app/miniapp/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { ethers } from "ethers";

/**
 * PUBS BURN — FINAL VERSION (FAST + ACCURATE ANKR BALANCE)
 *
 * - ANKR RPC for accurate balances
 * - Alchemy for fast token listing
 * - Auto add + auto select on search
 * - No logic removed
 */

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256, uint8)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];
const ERC20_ABI = ["function approve(address spender, uint256 amount) external returns (bool)"];

// caches
const metaCache = new Map<string, Token>();
const dexCache = new Map<string, { price: string | null; logo?: string }>();

type RiskLevel = "Low" | "Medium" | "High";

interface Token {
  address: string;
  rawBalance: bigint;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  logoUrl: string;
  price: string | null;
  isScam: boolean;
  risk?: RiskLevel;
  fetchedAt?: number;
}

export default function MiniAppPage() {
  const { address, isConnected } = useAccount();

  // STATES
  const [status, setStatus] = useState<string>("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);
  const [lastBurnTx, setLastBurnTx] = useState<string | null>(null);

  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlaySuccess, setOverlaySuccess] = useState("");

  const [showWalletOverlay, setShowWalletOverlay] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [queueRunning, setQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [analytics, setAnalytics] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // helper: safely replace or add token in tokens & filteredTokens by address
  const upsertTokenToLists = (token: Token) => {
    setTokens((prev) => {
      const found = prev.find((p) => p.address.toLowerCase() === token.address.toLowerCase());
      if (found) {
        return prev.map((p) =>
          p.address.toLowerCase() === token.address.toLowerCase()
            ? { ...p, ...token }
            : p
        );
      }
      return [token, ...prev];
    });

    setFilteredTokens((prev) => {
      const found = prev.find((p) => p.address.toLowerCase() === token.address.toLowerCase());
      if (found) {
        return prev.map((p) =>
          p.address.toLowerCase() === token.address.toLowerCase()
            ? { ...p, ...token }
            : p
        );
      }
      return [token, ...prev];
    });
  };

  // SHARE
  const shareToWarpcast = (txHash?: string) => {
    let msg =
      "🔥 PUBS BURN — Clean your wallet instantly!\n\n" +
      "Remove scam tokens and tidy up your wallet with one tap.\n";

    if (txHash) msg += `\n🧾 Burn tx:\nhttps://basescan.org/tx/${txHash}\n`;

    msg += "\nTry it now:\nhttps://farcaster.xyz/miniapps/mz8cOJsCFzrX";

    try {
      sdk.actions.openUrl(
        "https://warpcast.com/~/compose?text=" + encodeURIComponent(msg)
      );
    } catch {}
  };

  // Miniapp ready
  useEffect(() => {
    try {
      sdk.actions.ready();
    } catch {}
  }, []);

  // Auto load tokens when connected
  useEffect(() => {
    if (!isConnected || !address) return;
    const t = setTimeout(() => loadTokens(), 300);
    return () => clearTimeout(t);
  }, [isConnected, address]);
  // ---------------- LOAD TOKENS (FAST + AKURAT) ----------------
  const loadTokens = async () => {
    if (!address) return;

    const alchemy = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    const ankr = process.env.NEXT_PUBLIC_ANKR_RPC;

    if (!alchemy) return setStatus("⚠️ Missing NEXT_PUBLIC_ALCHEMY_KEY");
    if (!ankr) return setStatus("⚠️ Missing NEXT_PUBLIC_ANKR_RPC");

    setStatus("⏳ Scanning tokens...");

    try {
      // FAST list of tokens (Alchemy)
      const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${alchemy}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "alchemy_getTokenBalances",
          params: [address],
        }),
      });

      const data = await res.json();
      const list = data?.result?.tokenBalances ?? [];

      // Only tokens with > 0 balance are included
      const scanned: Token[] = list
        .filter((t: any) => BigInt(t.tokenBalance) > 0n)
        .map((t: any) => ({
          address: t.contractAddress,
          rawBalance: BigInt(t.tokenBalance),
          name: "Loading...",
          symbol: "",
          decimals: 18,
          balance: "0",
          logoUrl: "/token.png",
          price: null,
          isScam: false,
        }));

      const manual = tokens.filter(
        (x) => !scanned.find((s) => s.address.toLowerCase() === x.address.toLowerCase())
      );

      const merged = [...manual, ...scanned];

      setTokens(merged);
      setFilteredTokens(merged);
      setSelected([]);
      setStatus("🟢 Select token");

      // fetch metadata + price + accurate balance (ANKR)
      for (const token of merged) {
        try {
          // ---- metadata ----
          const metaRes = await fetch(`https://base-mainnet.g.alchemy.com/v2/${alchemy}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: 2,
              jsonrpc: "2.0",
              method: "alchemy_getTokenMetadata",
              params: [token.address],
            }),
          });

          const meta = await metaRes.json();
          const r = meta?.result;

          if (r) {
            token.decimals = r.decimals ?? token.decimals;
            token.name = r.name || token.name;
            token.symbol = r.symbol || token.symbol;
            token.logoUrl = r.logo || token.logoUrl;
          }

          // ---- accurate balance ----
          const balRes = await fetch(ankr, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "ankr_getAccountBalance",
              id: 1,
              params: {
                blockchain: "base",
                walletAddress: address,
                contractAddress: token.address,
              },
            }),
          });

          const balJ = await balRes.json();
          const precise = balJ?.result?.assets?.[0];

          if (precise?.balance) {
            const raw = BigInt(precise.balanceRaw ?? precise.balance ?? 0);
            token.rawBalance = raw;
            token.balance = ethers.formatUnits(raw, token.decimals);
          }

          // ---- price ----
          try {
            const priceRes = await fetch(
              `https://api.dexscreener.com/latest/dex/tokens/${token.address}`
            );
            const priceJ = await priceRes.json();

            token.price = priceJ?.pairs?.[0]?.priceUsd ?? null;
            const img = priceJ?.pairs?.[0]?.info?.imageUrl;
            if (img) token.logoUrl = img;

            token.isScam = !token.price || Number(token.price) === 0;
          } catch {}

          upsertTokenToLists({ ...token, fetchedAt: Date.now() });
        } catch {}
      }
    } catch (e) {
      console.error("SCAN ERROR", e);
      setStatus("❌ Failed to scan tokens");
    }
  };

  // --------------------------- BURN ---------------------------
  const burn = async () => {
    if (!selected.length) return setStatus("Select token(s) to burn.");

    setStatus("🔥 Starting...");

    const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    try {
      const need = selected.filter((x) => !approvedTokens.includes(x));

      // ---------- Approvals ----------
      if (need.length > 0) {
        for (const ca of need) {
          const row = tokens.find((x) => x.address === ca);
          if (!row) continue;

          try {
            setStatus(`🧾 Approving ${row.symbol}...`);
            setShowWalletOverlay(true);
            setOverlayLoading(true);
            setOverlayMessage(`Confirm approval for ${row.symbol}...`);

            const tokenC = new ethers.Contract(row.address, ERC20_ABI, signer);
            const tx = await tokenC.approve(CONTRACT, row.rawBalance);

            await rpc.waitForTransaction(tx.hash);

            setOverlayLoading(false);
            setOverlaySuccess(`${row.symbol} Approved!`);
            setTimeout(() => setOverlaySuccess(""), 1000);

            setApprovedTokens((prev) => [...prev, ca]);
          } catch (e: any) {
            setOverlayLoading(false);
            setShowWalletOverlay(false);
            return setStatus("Approval canceled or failed.");
          }

          setShowWalletOverlay(false);
        }

        setStatus("🟢 All tokens approved — tap burn now.");
        return;
      }

      // ---------------- MULTI BURN QUEUE ----------------
      if (selected.length > 1) {
        await runBurnQueue([...selected]);
        return;
      }

      // ---------------- SINGLE BURN ----------------
      for (const ca of selected) {
        const row = tokens.find((x) => x.address === ca);
        if (!row) continue;

        let fee: bigint = 0n;
        try {
          const [f] = await contract.quoteErc20Fee(row.address, row.rawBalance);
          fee = f;
        } catch {
          fee = ethers.parseUnits("0.0001", "ether");
        }

        try {
          setStatus(`🔥 Burning ${row.symbol}...`);
          setShowWalletOverlay(true);
          setOverlayLoading(true);
          setOverlayMessage(`Confirm burn for ${row.symbol}...`);

          const iface = new ethers.Interface(ABI);
          const data = iface.encodeFunctionData("burnToken", [
            row.address,
            row.rawBalance,
            JSON.stringify({ safe: true }),
          ]);

          const tx = await signer.sendTransaction({
            to: CONTRACT,
            data,
            value: fee,
           gasLimit: 350_000n,
          });

          await rpc.waitForTransaction(tx.hash);

          setOverlayLoading(false);
          setOverlaySuccess(`${row.symbol} Burned!`);

          setLastBurnTx(tx.hash);
          setTimeout(() => shareToWarpcast(tx.hash), 1200);
        } catch (e) {
          setOverlayLoading(false);
          setShowWalletOverlay(false);
          return setStatus("Burn failed.");
        }

        setShowWalletOverlay(false);
      }

      setApprovedTokens([]);
      setSelected([]);
      await loadTokens();
      setStatus("🎉 Success — Token burned!");
    } catch (e) {
      console.error(e);
      setStatus("❌ Failed.");
    }
  };

  // --------------------------- BURN QUEUE -------------------------
  const runBurnQueue = async (queue: string[]) => {
    setQueueRunning(true);
    setQueueProgress({ current: 0, total: queue.length });

    const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    const burned: any[] = [];
    let totalUsd = 0;

    for (let i = 0; i < queue.length; i++) {
      const ca = queue[i];
      setQueueProgress({ current: i + 1, total: queue.length });

      const row = tokens.find((x) => x.address === ca);
      if (!row) continue;

      try {
        let fee: bigint = 0n;
        try {
          const [f] = await contract.quoteErc20Fee(row.address, row.rawBalance);
          fee = f;
        } catch {
          fee = ethers.parseUnits("0.0001", "ether");
        }

        const iface = new ethers.Interface(ABI);
        const data = iface.encodeFunctionData("burnToken", [
          row.address,
          row.rawBalance,
          JSON.stringify({ safe: true }),
        ]);

        const tx = await signer.sendTransaction({
          to: CONTRACT,
          data,
          value: fee,
         gasLimit: 350_000n,
        });

        await rpc.waitForTransaction(tx.hash);

        burned.push({ token: row, txHash: tx.hash });

        if (row.price) {
          const usd = Number(row.price) * Number(row.balance);
          if (!isNaN(usd)) totalUsd += usd;
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {}
    }

    setQueueRunning(false);
    setQueueProgress({ current: 0, total: 0 });

    setAnalytics({
      count: burned.length,
      totalUsd: totalUsd.toFixed(2),
    });

    setSelected([]);
    setApprovedTokens([]);
    await loadTokens();
    setStatus("🎉 Queue completed!");
  };
  // ---------------------- SEARCH (FAST + AUTO-ADD + AUTO-SELECT) --------------------
  const handleSearch = async () => {
    setSearchError("");

    const qRaw = searchInput.trim();
    if (!qRaw) {
      setFilteredTokens(tokens);
      return;
    }

    const q = qRaw.toLowerCase();

    // --------- 1) LOCAL SEARCH (name / symbol) ----------
    const local = tokens.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.symbol || "").toLowerCase().includes(q)
    );

    if (local.length > 0) {
      setFilteredTokens(local);

      // auto select semua hasil
      setSelected((prev) =>
        Array.from(
          new Set([...prev, ...local.map((x) => x.address)])
        )
      );

      return;
    }

    // --------- 2) VALIDATE CONTRACT ADDRESS ----------
    const isAddress = /^0x[a-f0-9]{40}$/i.test(q);
    if (!isAddress) {
      setFilteredTokens([]);
      setSearchError("Token not found — try contract address");
      return;
    }

    // --------- 3) CACHED RESULT ----------
    if (metaCache.has(q)) {
      const cached = metaCache.get(q)!;

      upsertTokenToLists(cached);
      setSelected((prev) =>
        prev.includes(q) ? prev : [...prev, q]
      );
      return;
    }

    // --------- 4) FETCH META + PRICE + BALANCE ----------
    setSearchLoading(true);

    try {
      const alchemy = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
      const ankr = process.env.NEXT_PUBLIC_ANKR_RPC;

      if (!alchemy) {
        setSearchError("Missing Alchemy key");
        setSearchLoading(false);
        return;
      }

      if (!ankr) {
        setSearchError("Missing Ankr RPC");
        setSearchLoading(false);
        return;
      }

      // ---- A) Metadata ----
      const metaRes = await fetch(
        `https://base-mainnet.g.alchemy.com/v2/${alchemy}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: 99,
            jsonrpc: "2.0",
            method: "alchemy_getTokenMetadata",
            params: [q],
          }),
        }
      );

      const metaJ = await metaRes.json();
      const r = metaJ?.result;

      if (!r) {
        setSearchError("Token metadata not found");
        setSearchLoading(false);
        return;
      }

      // ---- B) Price (DexScreener) ----
      let price: string | null = null;
      let logo = r.logo || "/token.png";

      try {
        if (dexCache.has(q)) {
          const d = dexCache.get(q)!;
          price = d.price;
          logo = d.logo || logo;
        } else {
          const priceRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${q}`
          );
          const priceJ = await priceRes.json();

          price = priceJ?.pairs?.[0]?.priceUsd ?? null;
          const img = priceJ?.pairs?.[0]?.info?.imageUrl;
          if (img) logo = img;

          dexCache.set(q, { price, logo });
        }
      } catch {}

      // ---- C) Precise wallet balance (ANKR) ----
      let rawBalance = 0n;
      let balance = "0";

      try {
        const balRes = await fetch(ankr, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "ankr_getAccountBalance",
            id: 1,
            params: {
              blockchain: "base",
              walletAddress: address,
              contractAddress: q,
            },
          }),
        });

        const balJ = await balRes.json();
        const precise = balJ?.result?.assets?.[0];

        if (precise?.balance) {
          rawBalance = BigInt(
            precise.balanceRaw ?? precise.balance ?? 0
          );
          balance = ethers.formatUnits(
            rawBalance,
            r.decimals ?? 18
          );
        }
      } catch {}

      const risk: RiskLevel =
        !price || Number(price) === 0 ? "High" : "Low";

      const result: Token = {
        address: q,
        rawBalance,
        name: r.name || r.symbol || "Token",
        symbol: r.symbol || "",
        decimals: r.decimals ?? 18,
        balance,
        logoUrl: logo,
        price,
        isScam: risk === "High",
        risk,
        fetchedAt: Date.now(),
      };

      metaCache.set(q, result);
      upsertTokenToLists(result);

      // auto-select token baru
      setSelected((prev) =>
        prev.includes(q) ? prev : [...prev, q]
      );
    } catch (err) {
      console.error("SEARCH ERROR", err);
      setSearchError("Search failed");
    } finally {
      setSearchLoading(false);
    }
  };
  // --------------------------- UI ---------------------------
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">

      {/* TITLE */}
      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">
        PUBS BURN
      </h1>

      {/* ADDRESS */}
      <p className="text-sm text-gray-400 mb-3 text-center">
        {address
          ? `${address.slice(0, 6)}…${address.slice(-4)}`
          : "Connecting wallet..."}
      </p>

      {/* SEARCH BAR */}
      <div className="w-full max-w-sm mb-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search token (name or contract)"
            className="flex-1 px-4 py-3 rounded-xl bg-[#0F0F0F] border border-[#00FF3C30] text-white placeholder-gray-500"
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="px-4 py-3 rounded-xl bg-[#00FF3C] text-black font-semibold"
          >
            {searchLoading ? "..." : "Search"}
          </button>
        </div>
        {searchError && (
          <p className="text-red-500 text-xs mt-2">{searchError}</p>
        )}
      </div>

      {/* TOKEN LIST BOX */}
      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">

        {/* HEADER */}
        <div className="flex justify-between p-2 border-b border-[#00FF3C30] bg-[#111]">
          <div className="text-xs text-[#FF4A4A]">
            ALWAYS VERIFY BEFORE BURN 🚨
          </div>

          <button
            onClick={() =>
              selected.length === filteredTokens.length
                ? setSelected([])
                : setSelected(filteredTokens.map((t) => t.address))
            }
            className="text-xs text-[#00FF3C]"
          >
            {selected.length === filteredTokens.length
              ? "Unselect All"
              : "Select All"}
          </button>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 max-h-[330px] overflow-y-auto divide-y divide-[#222]">
          {filteredTokens.map((t) => {
            const active = selected.includes(t.address);

            return (
              <button
                key={t.address}
                onClick={() =>
                  setSelected(
                    active
                      ? selected.filter((x) => x !== t.address)
                      : [...selected, t.address]
                  )
                }
                className={`flex items-center w-full px-4 py-3 ${
                  active ? "bg-[#132A18]" : ""
                }`}
              >
                {/* LOGO */}
                <img
                  src={t.logoUrl}
                  className="w-7 h-7 rounded-full mr-3"
                />

                {/* NAME + BALANCE */}
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate flex items-center gap-1">
                    {t.name}
                    {(t.isScam || t.risk === "High") && (
                      <span className="text-[10px] text-red-400">
                        🚨
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.symbol} • {Number(t.balance || 0).toFixed(4)}
                  </div>
                </div>

                {/* PRICE */}
                <div
                  className={`text-sm ${
                    t.isScam ? "text-[#FF4A4A]" : "text-[#00FF3C]"
                  }`}
                >
                  {t.price ? `$${t.price}` : "0.00"}
                </div>

                {/* CHECKBOX */}
                <div className="ml-3 w-5 h-5 rounded border border-[#00FF3C] flex items-center justify-center">
                  {active && (
                    <div className="w-3 h-3 rounded bg-[#00FF3C]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ACTION BUTTONS */}
        <div className="p-3 border-t border-[#00FF3C30] bg-[#111] flex flex-col gap-3">

          {/* BURN / APPROVE */}
          <button
            onClick={burn}
            className={`w-full py-3 rounded-xl font-bold ${
              selected.length === 0
                ? "bg-[#2F2F2F] text-gray-500"
                : selected.every((s) => approvedTokens.includes(s))
                ? "bg-[#00FF3C] text-black"
                : "bg-[#FFB800] text-black"
            }`}
          >
            {selected.length === 0
              ? "Select token first"
              : selected.every((s) => approvedTokens.includes(s))
              ? `Burn Now (${selected.length})`
              : `Approve Selected (${selected.length})`}
          </button>

          {/* REFRESH */}
          <button
            onClick={loadTokens}
            className="w-full py-3 bg-[#2F2F2F] rounded-xl font-semibold text-[#EAEAEA]"
          >
            Scan / Refresh Tokens
          </button>
        </div>
      </div>

      {/* SHARE BUTTON */}
      {lastBurnTx && (
        <button
          onClick={() => shareToWarpcast(lastBurnTx)}
          className="mt-4 w-full max-w-sm py-3 bg-[#00FF3C] rounded-xl font-bold text-black"
        >
          📣 Share on Warpcast
        </button>
      )}

      {/* STATUS */}
      <p className="text-center text-sm text-gray-400 mt-4">
        {status}
      </p>

      {/* ---------------- OVERLAYS ---------------- */}

      {/* LOADING WALLET POPUP */}
      {overlayLoading && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999999]">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 border-4 border-gray-300 border-t-[#00FF3C] rounded-full animate-spin" />
            <p className="mt-4 text-white text-sm">{overlayMessage}</p>
          </div>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {overlaySuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999999]">
          <div className="px-6 py-4 bg-[#00FF3C] text-black rounded-xl text-lg font-semibold shadow-xl">
            {overlaySuccess}
          </div>
        </div>
      )}

      {/* QUEUE PROGRESS */}
      {queueRunning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000000]">
          <div className="w-[90%] max-w-md p-6 bg-[#0B0B0B] rounded-xl border border-[#00FF3C30]">
            <div className="text-lg font-bold">
              Burning tokens — progress
            </div>

            <div className="text-sm text-gray-400 mt-2">
              {queueProgress.current} / {queueProgress.total}
            </div>

            <div className="mt-4 w-full bg-[#111] rounded-full h-3">
              <div
                className="h-3 rounded-full bg-[#00FF3C]"
                style={{
                  width:
                    queueProgress.total === 0
                      ? "0%"
                      : `${Math.round(
                          (queueProgress.current /
                            queueProgress.total) *
                            100
                        )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS SUMMARY */}
      {analytics && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000000]">
          <div className="w-[90%] max-w-sm p-6 bg-[#0B0B0B] rounded-xl border border-[#00FF3C30]">
            <div className="text-xl font-bold">Burn Summary</div>

            <div className="mt-3 text-sm text-gray-300">
              Tokens burned:{" "}
              <span className="font-semibold">
                {analytics.count}
              </span>
            </div>

            <div className="mt-2 text-sm text-gray-300">
              Estimated value removed:{" "}
              <span className="font-semibold">
                ${analytics.totalUsd}
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  shareToWarpcast(lastBurnTx || undefined)
                }
                className="flex-1 py-2 rounded-xl bg-[#00FF3C] text-black font-bold"
              >
                Share Result
              </button>

              <button
                onClick={() => setAnalytics(null)}
                className="py-2 px-3 rounded-xl bg-[#2F2F2F] text-[#EAEAEA]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
