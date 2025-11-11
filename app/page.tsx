"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { encodeFunctionData } from "viem";
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

  const loadTokens = async () => {
    setStatus("Loading wallet tokens...");
    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    if (!address || !key) return;

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
    setStatus("✅ Token loaded");
  };

  const burn = async () => {
    try {
      if (!selected.length) return setStatus("Pilih token dulu.");

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
      setStatus("✅ Burn success!");
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
    <div className="min-h-screen bg-[#111] text-gray-100 p-6 overflow-x-hidden">

      <h1 className="text-4xl font-bold mb-6 text-center">PUBS BURN</h1>
      {isConnected ? (
        <p className="text-center text-gray-400 mb-4">{address}</p>
      ) : (
        <p className="text-center">Connecting wallet...</p>
      )}

      <button
        onClick={loadTokens}
        className="w-full bg-[#3b82f6] py-3 rounded-lg mb-4 font-semibold hover:bg-[#5ea1ff]"
      >
        🔄 Load Tokens
      </button>

      {/* LIST */}
      <div className="max-h-[420px] overflow-y-auto overflow-x-hidden divide-y divide-[#222] border border-[#333] rounded-xl">
        {tokens.map((t) => {
          const active = selected.includes(t.address);
          return (
            <button
              key={t.address}
              onClick={() =>
                setSelected(
                  active ? selected.filter((x) => x !== t.address) : [...selected, t.address]
                )
              }
              className={`flex items-center w-full px-4 py-3 text-left hover:bg-[#1a1a1a] transition max-w-full overflow-hidden ${
                active ? "bg-[#193c29]" : ""
              }`}
            >
              <img src={t.logoUrl} className="w-8 h-8 rounded-full mr-3 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {t.symbol} • {t.balance.toFixed(4)}
                </div>
              </div>
              <div className="text-sm text-gray-300 shrink-0">${t.price ?? "-"}</div>
              <div className="ml-3 w-5 h-5 rounded border border-gray-500 shrink-0">
                {active && <div className="w-full h-full bg-[#2ecc71] rounded" />}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={burn}
        className="mt-5 w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold"
      >
        🔥 Burn Selected
      </button>

      {lastBurnTx && (
        <button
          onClick={shareWarpcast}
          className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold"
        >
          📣 Share on Warpcast
        </button>
      )}

      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
