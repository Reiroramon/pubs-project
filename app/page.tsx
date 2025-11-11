"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { ethers } from "ethers";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256, uint8)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];

export default function HomePage() {
  const { address, isConnected } = useAccount();

  const [status, setStatus] = useState("");
  const [tokens, setTokens] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastBurnTx, setLastBurnTx] = useState<string | null>(null);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // ✅ AUTO LOAD TOKENS — saat wallet siap
  useEffect(() => {
    if (!isConnected || !address) return;

    // delay 350ms agar provider & RPC ready (ini yang bikin sebelumnya gagal)
    const t = setTimeout(() => {
      loadTokens();
    }, 350);

    return () => clearTimeout(t);
  }, [isConnected, address]);

  const loadTokens = async () => {
    if (!address) return;
    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    if (!key) return setStatus("⚠️ NEXT_PUBLIC_ALCHEMY_KEY belum di isi");

    setStatus("⏳ Scanning tokens...");

    const result = await fetch(`https://base-mainnet.g.alchemy.com/v2/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address],
      }),
    }).then((r) => r.json());

    const list = result?.result?.tokenBalances ?? [];

    const final = await Promise.all(
      list.map(async (t: any) => {
        const meta = await fetch(`https://base-mainnet.g.alchemy.com/v2/${key}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: 2,
            jsonrpc: "2.0",
            method: "alchemy_getTokenMetadata",
            params: [t.contractAddress],
          }),
        }).then((r) => r.json());

        const { decimals, name, symbol, logo } = meta?.result ?? {};
        const balance = Number(ethers.formatUnits(t.tokenBalance, decimals ?? 18));

        const priceRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.contractAddress}`)
          .then((r) => r.json())
          .catch(() => null);

        const price = priceRes?.pairs?.[0]?.priceUsd ?? null;
        const logoUrl = priceRes?.pairs?.[0]?.info?.imageUrl ?? logo ?? "/token.png";

        return {
          address: t.contractAddress,
          name: name || symbol || "Unknown",
          symbol: symbol || "TKN",
          decimals: decimals ?? 18,
          balance,
          logoUrl,
          price,
        };
      })
    );

    setTokens(final.filter((t) => t.balance > 0));
    setStatus("✅ Tokens Ready ✅");
  };


  const burn = async () => {
    if (!selected.length) return setStatus("Select token to burn.");

    try {
      setStatus("🔥 Preparing burn...");

      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);

      const calls = [];

      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        const amountWei = ethers.parseUnits(row.balance.toString(), row.decimals);
        const [feeWei] = await contract.quoteErc20Fee(row.address, amountWei);

        calls.push({
          to: CONTRACT,
          value: feeWei,
          data: contract.interface.encodeFunctionData("burnToken", [
            row.address,
            amountWei,
            JSON.stringify({ safe: true }),
          ]),
        });
      }

      const res = await (sdk as any).wallet.ethProvider.request({
        method: "wallet_sendCalls",
        params: [{ calls }],
      });

      setLastBurnTx(res?.transactionHash || res?.hash || null);
      setStatus("✅ Burn Success!");
      setSelected([]);
      loadTokens(); // auto refresh after burn

    } catch (e: any) {
      setStatus("❌ " + e.message);
    }
  };

  const shareWarpcast = () => {
    if (!lastBurnTx) return;
    sdk.actions.openUrl(
      `https://warpcast.com/~/compose?text=${encodeURIComponent(
        "I just cleaned my wallet by burning scam tokens using PUBS BURN ♻️🔥 #SafeOnchain"
      )}`
    );
  };

  return (
    <div className="min-h-screen bg-[#111] text-gray-100 px-4 py-5 flex flex-col items-center overflow-hidden">

      <h1 className="text-3xl font-bold text-center mb-2">PUBS BURN</h1>
      <p className="text-sm text-gray-400 mb-3">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting..."}
      </p>

      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#333] overflow-hidden">

        {/* Select All */}
        <div className="flex justify-end p-2 border-b border-[#222] bg-[#111] sticky top-0 z-10">
          <button
            onClick={() =>
              selected.length === tokens.length ? setSelected([]) : setSelected(tokens.map(t => t.address))
            }
            className="text-sm text-[#3b82f6]"
          >
            {selected.length === tokens.length ? "Unselect All" : "Select All"}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 max-h-[380px] overflow-y-auto divide-y divide-[#222] no-scrollbar">
          {tokens.map((t) => {
            const active = selected.includes(t.address);
            return (
              <button
                key={t.address}
                onClick={() =>
                  setSelected(active ? selected.filter((x) => x !== t.address) : [...selected, t.address])
                }
                className={`flex items-center px-4 py-3 text-left hover:bg-[#1a1a1a] ${
                  active ? "bg-[#193c29]" : ""
                }`}
              >
                <img src={t.logoUrl} className="w-7 h-7 rounded-full mr-3" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-gray-400 truncate">{t.symbol} • {t.balance.toFixed(4)}</div>
                </div>
                <div className="text-sm text-gray-300">${t.price ?? "-"}</div>
              </button>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="p-3 border-t border-[#222] bg-[#111] flex flex-col gap-2">
          <button onClick={burn} className="py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold">
            🔥 Burn Selected {selected.length > 0 && `(${selected.length})`}
          </button>
        </div>
      </div>

      {lastBurnTx && (
        <button onClick={shareWarpcast} className="mt-3 w-full max-w-sm py-3 bg-purple-600 rounded-xl">
          📣 Share on Warpcast
        </button>
      )}

      <p className="text-center text-sm text-gray-400 mt-3">{status}</p>
    </div>
  );
}

