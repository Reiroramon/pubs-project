// app/miniapp/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { ethers } from "ethers";

/**
 * PUBS BURN - Mini App Page (enhanced)
 */

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256, uint8)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

// Simple in-memory cache (turbo search)
const metaCache = new Map<string, any>();
const dexCache = new Map<string, any>();

export default function MiniAppPage() {
  const { address, isConnected } = useAccount();

  // core states
  const [status, setStatus] = useState("");
  const [tokens, setTokens] = useState<any[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);
  const [lastBurnTx, setLastBurnTx] = useState<string | null>(null);

  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlaySuccess, setOverlaySuccess] = useState("");
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);

  // search states
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // queue modal
  const [queueRunning, setQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [analytics, setAnalytics] = useState<any | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // share helper
  const shareToWarpcast = (txHash?: string) => {
    let msg =
      "🔥 PUBS BURN — Clean your wallet instantly!\n\n" +
      "Remove scam tokens and tidy up your wallet with one tap.\n";

    if (txHash) {
      msg += `\n🧾 My burn transaction:\nhttps://basescan.org/tx/${txHash}\n`;
    }

    msg += "\nTry it now:\nhttps://farcaster.xyz/miniapps/mz8cOJsCFzrX";

    sdk.actions.openUrl(
      "https://warpcast.com/~/compose?text=" + encodeURIComponent(msg)
    );
  };

  // ready
  useEffect(() => {
    try {
      sdk.actions.ready();
    } catch {}
  }, []);
  // load tokens
  useEffect(() => {
    if (!isConnected || !address) return;
    const t = setTimeout(() => loadTokens(), 400);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  const loadTokens = async () => {
    if (!address) return;
    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    if (!key) return setStatus("⚠️ NEXT_PUBLIC_ALCHEMY_KEY belum diisi");

    setStatus("⏳ Scanning tokens...");
    try {
      const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${key}`, {
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

      let baseList = list
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

      setTokens(baseList);
      setFilteredTokens(baseList);
      setStatus("🟢 Select token");

      baseList.forEach(async (token: any, i: number) => {
        try {
          // metadata
          const metaRes = await fetch(
            `https://base-mainnet.g.alchemy.com/v2/${key}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                id: 2,
                jsonrpc: "2.0",
                method: "alchemy_getTokenMetadata",
                params: [token.address],
              }),
            }
          );
          const meta = await metaRes.json();
          const r = meta?.result;
          if (r) {
            token.decimals = r.decimals ?? 18;
            token.name = r.name || r.symbol || "Token";
            token.symbol = r.symbol || "";
            token.logoUrl = r.logo || "/token.png";
            token.balance = ethers.formatUnits(
              token.rawBalance,
              token.decimals
            );
          }

          // price/logo
          try {
            const priceRes = await fetch(
              `https://api.dexscreener.com/latest/dex/tokens/${token.address}`
            );
            const priceJ = await priceRes.json();

            token.price = priceJ?.pairs?.[0]?.priceUsd ?? null;
            const img = priceJ?.pairs?.[0]?.info?.imageUrl;
            if (img) token.logoUrl = img;

            token.isScam = !token.price || Number(token.price) === 0;
          } catch {
            token.price = null;
          }
        } catch {}

        setTokens((prev) => {
          const updated = [...prev];
          updated[i] = { ...token };
          return updated;
        });
        setFilteredTokens((prev) => {
          const updated = [...prev];
          updated[i] = { ...token };
          return updated;
        });
      });
    } catch (err) {
      console.error("SCAN ERROR:", err);
      setStatus("❌ Failed to scan tokens");
    }
  };

  // ------------------ BURN ------------------
  const burn = async () => {
    if (!selected.length) return setStatus("Select token(s) to burn.");
    setStatus("🔥 Starting process...");

    const provider = new ethers.BrowserProvider(
      (sdk as any).wallet.ethProvider as any
    );
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    try {
      const needApproval = selected.filter(
        (addr) => !approvedTokens.includes(addr)
      );

      // APPROVAL
      if (needApproval.length > 0) {
        for (const tokenAddress of needApproval) {
          const row =
            tokens.find((t) => t.address === tokenAddress) ||
            filteredTokens.find((t) => t.address === tokenAddress);
          if (!row) continue;

          try {
            setStatus(`🧾 Approving ${row.symbol}...`);
            setShowWalletOverlay(true);
            setOverlayMessage(
              `Waiting wallet popup to approve ${row.symbol}...`
            );
            setOverlayLoading(true);

            const tokenContract = new ethers.Contract(
              row.address,
              ERC20_ABI,
              signer
            );
            const tx = await tokenContract.approve(
              CONTRACT,
              row.rawBalance,
              { gasLimit: 200_000n }
            );

            setOverlayMessage(`Confirming ${row.symbol} approval...`);
            await rpc.waitForTransaction(tx.hash);

            setOverlayLoading(false);
            setOverlaySuccess(`${row.symbol} Approved!`);
            setTimeout(() => setOverlaySuccess(""), 1200);

            setApprovedTokens((prev) => [...prev, tokenAddress]);
          } catch (err: any) {
            setOverlayLoading(false);
            setShowWalletOverlay(false);
            if (err?.code === 4001) setStatus("User canceled approve");
            else setStatus("Approve failed");
            return;
          }

          setShowWalletOverlay(false);
          setOverlayMessage("");
        }
        setStatus("🟢 All tokens approved. Tap Burn Now.");
        return;
      }

      // MULTI BURN
      if (selected.length > 1) {
        await runBurnQueue([...selected]);
        return;
      }

      // SINGLE BURN
      for (const tokenAddress of selected) {
        const row =
          tokens.find((t) => t.address === tokenAddress) ||
          filteredTokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        let feeWei = 0n;
        try {
          const [feeRequired] = await contract.quoteErc20Fee(
            row.address,
            row.rawBalance
          );
          feeWei = feeRequired;
        } catch {
          feeWei = ethers.parseUnits("0.0001", "ether");
        }

        try {
          setStatus(`🔥 Burning ${row.symbol}...`);
          setShowWalletOverlay(true);
          setOverlayMessage(
            `Waiting wallet popup to burn ${row.symbol}...`
          );
          setOverlayLoading(true);

          const iface = new ethers.Interface(ABI);
          const data = iface.encodeFunctionData("burnToken", [
            row.address,
            row.rawBalance,
            JSON.stringify({ safe: true }),
          ]);

          const tx = await signer.sendTransaction({
            to: CONTRACT,
            data,
            value: feeWei,
            gasLimit: 350_000n,
          });

          setOverlayMessage(
            `Waiting burn confirmation for ${row.symbol}...`
          );
          await rpc.waitForTransaction(tx.hash);

          setOverlayLoading(false);
          setOverlaySuccess(`${row.symbol} Burned!`);
          setTimeout(() => setOverlaySuccess(""), 1200);

          setLastBurnTx(tx.hash);
          setTimeout(() => shareToWarpcast(tx.hash), 1500);

          setStatus(`✅ Burned ${row.symbol} successfully!`);
        } catch (err: any) {
          setOverlayLoading(false);
          setShowWalletOverlay(false);
          if (err?.code === 4001)
            setStatus("User canceled burn");
          else setStatus("Burn failed");
          continue;
        }

        setShowWalletOverlay(false);
        setOverlayMessage("");
      }

      setApprovedTokens([]);
      setSelected([]);
      await loadTokens();
      setStatus("🎉 All selected tokens burned successfully!");
    } catch (outerErr: any) {
      console.error(outerErr);
      setShowWalletOverlay(false);
      setStatus("❌ Failed, try again.");
    }
  };

  // ----------------- RUN BURN QUEUE -----------------
  const runBurnQueue = async (queue: string[]) => {
    setQueueRunning(true);
    setQueueProgress({ current: 0, total: queue.length });

    const provider = new ethers.BrowserProvider(
      (sdk as any).wallet.ethProvider as any
    );
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    const burnedItems: any[] = [];
    let totalUsd = 0;

    for (let i = 0; i < queue.length; i++) {
      const ca = queue[i];
      setQueueProgress({ current: i + 1, total: queue.length });

      const row =
        tokens.find((t) => t.address === ca) ||
        filteredTokens.find((t) => t.address === ca);
      if (!row) continue;

      try {
        setStatus(`🔥 Burning ${row.symbol || row.address} ...`);

        let feeWei = 0n;
        try {
          const [feeRequired] = await contract.quoteErc20Fee(
            row.address,
            row.rawBalance
          );
          feeWei = feeRequired;
        } catch {
          feeWei = ethers.parseUnits("0.0001", "ether");
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
          value: feeWei,
          gasLimit: 350_000n,
        });

        await rpc.waitForTransaction(tx.hash);

        burnedItems.push({ token: row, txHash: tx.hash });
        if (row.price) {
          const usd =
            Number(row.price) * Number(row.balance || 0);
          totalUsd += isNaN(usd) ? 0 : usd;
        }

        await new Promise((res) => setTimeout(res, 700));
      } catch (e) {
        console.error("QUEUE ITEM FAILED", e);
      }
    }

    setQueueRunning(false);
    setQueueProgress({ current: 0, total: 0 });

    setAnalytics({
      count: burnedItems.length,
      totalUsd: totalUsd.toFixed(2),
    });

    setSelected([]);
    setApprovedTokens([]);
    await loadTokens();
    setStatus("🎉 All selected tokens burned successfully!");
  };

  // ----------------- SEARCH -----------------
  const handleSearch = async () => {
    setSearchError("");
    setSearchResult(null);
    const qRaw = searchInput.trim();
    if (!qRaw) {
      setFilteredTokens(tokens);
      return;
    }
    const q = qRaw.toLowerCase();

    // local search
    const local = tokens.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.symbol || "").toLowerCase().includes(q)
    );
    if (local.length > 0) {
      setFilteredTokens(local);
      setSearchResult(null);
      return;
    }

    // exact CA
    const isAddress = /^0x[a-f0-9]{40}$/i.test(q);
    if (!isAddress) {
      setFilteredTokens([]);
      setSearchError("Not found (try contract address)");
      return;
    }

    if (metaCache.has(q)) {
      const cached = metaCache.get(q);
      setSearchResult(cached);
      setFilteredTokens([cached]);

      // AUTO SELECT
      setSelected((prev) =>
        prev.includes(q) ? prev : [...prev, q]
      );
      return;
    }

    setSearchLoading(true);
    try {
      const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
      if (!key) {
        setSearchError("Alchemy key missing");
        setSearchLoading(false);
        return;
      }

      // fetch metadata
      const metaRes = await fetch(
        `https://base-mainnet.g.alchemy.com/v2/${key}`,
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

      // DexScreener
      let price = null;
      let logo = r.logo || "/token.png";
      try {
        if (dexCache.has(q)) {
          const dexCached = dexCache.get(q);
          price = dexCached.price;
          logo = dexCached.logo || logo;
        } else {
          const dexRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${q}`
          );
          const dexJ = await dexRes.json();
          price = dexJ?.pairs?.[0]?.priceUsd ?? null;
          const img = dexJ?.pairs?.[0]?.info?.imageUrl;
          if (img) logo = img;
          dexCache.set(q, { price, logo });
        }
      } catch {}

      // Balance
      let rawBalance = 0n;
      let balance = "0";
      try {
        const balRes = await fetch(
          `https://base-mainnet.g.alchemy.com/v2/${key}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: 2,
              jsonrpc: "2.0",
              method: "alchemy_getTokenBalances",
              params: [address],
            }),
          }
        );
        const balJ = await balRes.json();
        const all = balJ?.result?.tokenBalances ?? [];
        const found = all.find(
          (t: any) =>
            (t.contractAddress ?? "").toLowerCase() === q
        );
        if (found) {
          rawBalance = BigInt(found.tokenBalance);
          balance = ethers.formatUnits(
            rawBalance,
            r.decimals ?? 18
          );
        }
      } catch {}

      let risk: "Low" | "Medium" | "High" = "Low";
      if (!price || Number(price) === 0) risk = "High";

      const result = {
        address: q,
        rawBalance,
        name: r.name || r.symbol || "Token",
        symbol: r.symbol || "",
        decimals: r.decimals ?? 18,
        balance,
        logoUrl: logo,
        price,
        isScam: !price || Number(price) === 0,
        risk,
        fetchedAt: Date.now(),
      };

      metaCache.set(q, result);
      setSearchResult(result);
      setFilteredTokens([result]);

      // 💥 AUTO SELECT TANPA ADD TO LIST
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

  // ======================= UI ============================
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">
      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">
        PUBS BURN
      </h1>

      <p className="text-sm text-gray-400 mb-2 text-center">
        {address
          ? `${address.slice(0, 6)}…${address.slice(-4)}`
          : "Connecting wallet..."}
      </p>

      {/* SEARCH INPUT */}
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

      {/* TOKEN LIST */}
      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">
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
                <img
                  src={t.logoUrl}
                  className="w-7 h-7 rounded-full mr-3"
                />

                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate flex items-center gap-1">
                    {t.name}
                    {(t.risk === "High" || t.isScam) && (
                      <span className="text-[10px] text-red-400 ml-1">
                        🚨
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.symbol} •{" "}
                    {Number(t.balance || 0).toFixed(4)}
                  </div>
                </div>

                <div
                  className={`text-sm ${
                    t.isScam ? "text-[#FF4A4A]" : "text-[#00FF3C]"
                  }`}
                >
                  {t.price ? `$${t.price}` : "0.00"}
                </div>

                <div className="ml-3 w-5 h-5 rounded border border-[#00FF3C] flex items-center justify-center">
                  {active && (
                    <div className="w-3 h-3 rounded bg-[#00FF3C]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ACTIONS */}
        <div className="p-3 border-t border-[#00FF3C30] bg-[#111] flex flex-col gap-3">
          <button
            onClick={burn}
            className={`w-full py-3 rounded-xl font-bold ${
              selected.every((s) => approvedTokens.includes(s))
                ? "bg-[#00FF3C] text-black"
                : "bg-[#FFB800] text-black"
            }`}
          >
            {selected.length === 0
              ? "Select token first"
              : selected.every((s) =>
                  approvedTokens.includes(s)
                )
              ? `Burn Now (${selected.length})`
              : `Approve Selected (${selected.length})`}
          </button>

          <button
            onClick={loadTokens}
            className="w-full py-3 bg-[#2F2F2F] rounded-xl font-semibold text-[#EAEAEA]"
          >
            Scan / Refresh Tokens
          </button>
        </div>
      </div>

      {/* SHARE */}
      {lastBurnTx && (
        <button
          onClick={() => shareToWarpcast(lastBurnTx)}
          className="mt-4 w-full max-w-sm py-3 bg-[#00FF3C] rounded-xl font-bold text-black"
        >
          📣 Share on Warpcast
        </button>
      )}

      <p className="text-center text-sm text-gray-400 mt-4">
        {status}
      </p>

      {/* WALLET OVERLAY */}
      {overlayLoading && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999999]">
          <div className="flex flex-col items-center">
            <div className="h-12 w-12 border-4 border-gray-300 border-t-[#00FF3C] rounded-full animate-spin" />
            <p className="mt-4 text-white text-sm">
              {overlayMessage}
            </p>
          </div>
        </div>
      )}

      {overlaySuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999999]">
          <div className="px-6 py-4 bg-[#00FF3C] text-black rounded-2xl text-lg font-semibold shadow-xl">
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

      {/* ANALYTICS */}
      {analytics && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000000]">
          <div className="w-[90%] max-w-sm p-6 bg-[#0B0B0B] rounded-xl border border-[#00FF3C30]">
            <div className="text-xl font-bold">
              Burn Summary
            </div>
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
