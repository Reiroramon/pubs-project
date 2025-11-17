"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { ethers } from "ethers";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256, uint8)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

export default function MiniAppPage() {
  const { address, isConnected } = useAccount();

  const [status, setStatus] = useState("");
  const [tokens, setTokens] = useState<any[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);
  const [lastBurnTx, setLastBurnTx] = useState<string | null>(null);

  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlaySuccess, setOverlaySuccess] = useState("");
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);

  // ========================= SEARCH FILTER =========================
  const handleSearch = () => {
    if (!searchInput.trim()) {
      setFilteredTokens(tokens);
      return;
    }

    const q = searchInput.toLowerCase();

    const results = tokens.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
    );

    setFilteredTokens(results);
  };
  // ================================================================

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

  // =================== READY =======================
  useEffect(() => {
    try {
      sdk.actions.ready();
    } catch {}
  }, []);
  useEffect(() => {
    if (!isConnected || !address) return;
    const t = setTimeout(loadTokens, 400);
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
          const metaRes = await fetch(`https://base-mainnet.g.alchemy.com/v2/${key}`, {
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
            token.decimals = r.decimals ?? 18;
            token.name = r.name || r.symbol || "Token";
            token.symbol = r.symbol || "";
            token.logoUrl = r.logo || "/token.png";
            token.balance = ethers.formatUnits(token.rawBalance, token.decimals);
          }

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
      setStatus("❌ Failed to scan tokens");
    }
  };
  const burn = async () => {
    if (!selected.length) return setStatus("Select token(s) to burn.");

    setStatus("🔥 Starting process...");

    const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    try {
      const needApproval = selected.filter((addr) => !approvedTokens.includes(addr));
      if (needApproval.length > 0) {
        // approval logic — ORIGINAL, tidak aku hapus
        for (const tokenAddress of needApproval) {
          const row = tokens.find((t) => t.address === tokenAddress);
          if (!row) continue;

          try {
            setStatus(`🧾 Approving ${row.symbol}...`);

            setShowWalletOverlay(true);
            setOverlayMessage(`Waiting wallet popup to approve ${row.symbol}...`);
            setOverlayLoading(true);

            const tokenContract = new ethers.Contract(row.address, ERC20_ABI, signer);
            const tx = await tokenContract.approve(CONTRACT, row.rawBalance);

            setOverlayMessage(`Confirming ${row.symbol} approval...`);
            await rpc.waitForTransaction(tx.hash);

            setOverlayLoading(false);
            setOverlaySuccess(`${row.symbol} Approved!`);
            setTimeout(() => setOverlaySuccess(""), 1200);

            setApprovedTokens((prev) => [...prev, tokenAddress]);
          } catch {
            setOverlayLoading(false);
            setShowWalletOverlay(false);
            return;
          }

          setShowWalletOverlay(false);
          setOverlayMessage("");
        }

        setStatus("🟢 All tokens approved. Tap Burn Now.");
        return;
      }

      // ==================== BURN ====================
      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        let feeWei = 0n;
        try {
          const [feeRequired] = await contract.quoteErc20Fee(row.address, row.rawBalance);
          feeWei = feeRequired;
        } catch {
          feeWei = ethers.parseUnits("0.0001", "ether");
        }

        try {
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

          setLastBurnTx(tx.hash);
          setTimeout(() => shareToWarpcast(tx.hash), 1500);

          setStatus(`✅ Burned ${row.symbol} successfully!`);
        } catch {}
      }

      setSelected([]);
      setApprovedTokens([]);
      await loadTokens();

      setStatus("🎉 All selected tokens burned successfully!");
    } catch {
      setStatus("❌ Failed, try again.");
    }
  };
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">

      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">PUBS BURN</h1>

      <p className="text-sm text-gray-400 mb-2 text-center">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting wallet..."}
      </p>

      {/* ================= SEARCH BAR ================= */}
      <div className="w-full max-w-sm mb-3">
        <input
          className="w-full px-4 py-3 rounded-xl bg-black border border-[#00FF3C50] text-white"
          placeholder="Search token (name or contract address)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button
          onClick={handleSearch}
          className="mt-2 w-full py-3 bg-[#00FF3C] text-black font-bold rounded-xl"
        >
          Search Token
        </button>
      </div>
      {/* ================================================= */}

      {/* ===================== MAIN CARD ===================== */}
      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">

        <div className="flex justify-between p-2 border-b border-[#00FF3C30] bg-[#111] sticky top-0 z-10">
          <div className="text-xs text-[#FF4A4A]">ALWAYS VERIFY BEFORE BURN 🚨</div>

          <button
            onClick={() =>
              selected.length === filteredTokens.length
                ? setSelected([])
                : setSelected(filteredTokens.map((t) => t.address))
            }
            className="text-xs text-[#00FF3C]"
          >
            {selected.length === filteredTokens.length ? "Unselect All" : "Select All"}
          </button>
        </div>

        <div className="flex-1 max-h-[330px] overflow-y-auto divide-y divide-[#222] no-scrollbar">
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
                className={`flex items-center w-full px-4 py-3 hover:bg-[#1A1F1A] transition ${
                  active ? "bg-[#132A18]" : ""
                }`}
              >
                <img src={t.logoUrl} className="w-7 h-7 rounded-full mr-3" />

                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate flex items-center gap-1">
                    {t.name}
                    {t.isScam && <span className="text-[10px] text-[#FF4A4A]">🚨</span>}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.symbol} • {Number(t.balance).toFixed(4)}
                  </div>
                </div>

                <div
                  className={`text-sm ${t.isScam ? "text-[#FF4A4A]" : "text-[#00FF3C]"}`}
                >
                  {t.price ? `$${t.price}` : "0.00"}
                </div>

                <div className="ml-3 w-5 h-5 rounded border border-[#00FF3C] flex items-center justify-center">
                  {active && <div className="w-3 h-3 rounded bg-[#00FF3C]" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-[#00FF3C30] bg-[#111] flex flex-col gap-3">

          <button
            onClick={burn}
            className={`w-full py-3 rounded-xl font-bold ${
              selected.every((s) => approvedTokens.includes(s))
                ? "bg-[#00FF3C] hover:bg-[#32FF67] text-black"
                : "bg-[#FFB800] hover:bg-[#FFCC33] text-black"
            }`}
          >
            {selected.length === 0
              ? "Select token first"
              : selected.every((s) => approvedTokens.includes(s))
              ? `Burn Now (${selected.length})`
              : `Approve Selected (${selected.length})`}
          </button>

          <button
            onClick={loadTokens}
            className="w-full py-3 bg-[#2F2F2F] hover:bg-[#3A3A3A] rounded-xl font-semibold text-[#EAEAEA]"
          >
            Scan / Refresh Tokens
          </button>

        </div>
      </div>

      {lastBurnTx && (
        <button
          onClick={() => shareToWarpcast(lastBurnTx)}
          className="mt-4 w-full max-w-sm py-3 bg-[#00FF3C] hover:bg-[#32FF67] rounded-xl font-bold text-black shadow-lg"
        >
          📣 Share on Warpcast
        </button>
      )}

      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
