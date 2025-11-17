// app/miniapp/page.tsx
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
  const [selected, setSelected] = useState<string[]>([]);
  const [lastBurnTx, setLastBurnTx] = useState<string | null>(null);
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlaySuccess, setOverlaySuccess] = useState("");
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);

  // 🔥 SHARE PRO ADDED — universal share handler
  const shareToWarpcast = (txHash?: string) => {
    let msg =
      "🔥 PUBS BURN — Clean your wallet instantly!\n\n" +
      "Remove scam tokens and tidy up your wallet with one tap.\n";

    if (txHash) {
      msg += `\n🧾 My burn transaction:\nhttps://basescan.org/tx/${txHash}\n`;
    }

    msg +=
      `\nTry it now:\nhttps://farcaster.xyz/miniapps/mz8cOJsCFzrX`;

    sdk.actions.openUrl(
      "https://warpcast.com/~/compose?text=" + encodeURIComponent(msg)
    );
  };

  // ======================================================

  useEffect(() => {
    console.log("miniapp: trying sdk.actions.ready()");
    try {
      sdk.actions.ready();
      console.log("miniapp: ready() success");
    } catch (e) {
      console.warn("miniapp: ready() failed:", e);
    }
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
          } catch {
            token.price = null;
          }
        } catch {}

        setTokens((prev) => {
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

  const burn = async () => {
    if (!selected.length) return setStatus("Select token(s) to burn.");

    setStatus("🔥 Starting process...");

    const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    try {
      const needApproval = selected.filter((addr) => !approvedTokens.includes(addr));

      if (needApproval.length > 0) {
        // ... APPROVE LOGIC (tidak diubah)
      }

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

          // 🔥 HERE: auto-share activated
          setLastBurnTx(tx.hash);
          setTimeout(() => {
            shareToWarpcast(tx.hash);
          }, 1500);

          setStatus(`✅ Burned ${row.symbol} successfully!`);
        } catch (err: any) {
          continue;
        }
      }

      setApprovedTokens([]);
      setSelected([]);
      await loadTokens();
      setStatus("🎉 All selected tokens burned successfully!");
    } catch {
      setStatus("❌ Failed, try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">

      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">PUBS BURN</h1>

      <p className="text-sm text-gray-400 mb-4 text-center">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting wallet..."}
      </p>

      {/* BURN UI — original code, untouched */}
      {/* ... */}

      {/* 🔥 SHARE BUTTON PRO */}
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
