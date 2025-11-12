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
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
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

      const final = await Promise.all(
        list.map(async (t: any) => {
          const metaRes = await fetch(`https://base-mainnet.g.alchemy.com/v2/${key}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              id: 2,
              jsonrpc: "2.0",
              method: "alchemy_getTokenMetadata",
              params: [t.contractAddress],
            }),
          });
          const meta = await metaRes.json();
          const { decimals, name, symbol, logo } = meta?.result ?? {};
          const decimalsSafe = decimals ?? 18;

          const balance = ethers.formatUnits(t.tokenBalance, decimalsSafe);
          const priceRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${t.contractAddress}`
          ).then((r) => r.json()).catch(() => null);

          const price = priceRes?.pairs?.[0]?.priceUsd ?? null;
          const logoUrl = priceRes?.pairs?.[0]?.info?.imageUrl ?? logo ?? "/token.png";

          return {
            address: t.contractAddress,
            name: name || symbol || "Unknown",
            symbol: symbol || "TKN",
            decimals: decimalsSafe,
            balance,
            rawBalance: BigInt(t.tokenBalance),
            logoUrl,
            price,
            isScam: !price || Number(price) === 0,
          };
        })
      );

      setTokens(final.filter((t) => Number(t.balance) > 0));
      setStatus("✅ Ready to burn");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to scan tokens");
    }
  };

  const burn = async () => {
  if (!selected.length) return setStatus("Select token(s) to burn.");

  try {
    setStatus("🔥 Starting approval & burn...");
    const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer) as unknown as {
  burnToken: (
    token: string,
    amount: bigint,
    scanSummary: string,
    opts?: { value?: bigint; gasLimit?: bigint }
  ) => Promise<any>;
  quoteErc20Fee: (token: string, amount: bigint) => Promise<[bigint, number]>;
  callStatic: {
    burnToken: (
      token: string,
      amount: bigint,
      scanSummary: string,
      opts?: { value?: bigint }
    ) => Promise<void>;
  };
};


    for (const tokenAddress of selected) {
      const row = tokens.find((t) => t.address === tokenAddress);
      if (!row || row.rawBalance === 0n) continue;

     const tokenContract = new ethers.Contract(row.address, ERC20_ABI, signer) as unknown as {
  approve: (spender: string, amount: bigint, opts?: { gasLimit?: bigint }) => Promise<any>;
};

      // ✅ STEP 1 — APPROVE
      try {
        setStatus(`🧾 Approving ${row.symbol}...`);
        const approveTx = await tokenContract.approve(CONTRACT, row.rawBalance, {
          gasLimit: 200_000n,
        });
        await approveTx.wait();
        console.log(`✅ Approved ${row.symbol}`);
      } catch (err) {
        console.warn(`⛔ Approve failed for ${row.symbol}, skipping.`, err);
        continue;
      }

      // ✅ STEP 2 — GET FEE OR USE FALLBACK
      let feeWei: bigint;
      try {
        const [fee] = await contract.quoteErc20Fee(row.address, row.rawBalance);
        feeWei = fee && fee > 0n ? fee : ethers.parseUnits("0.00001", "ether");
      } catch {
        feeWei = ethers.parseUnits("0.00001", "ether"); // fallback
      }

      // ✅ STEP 3 — CHECK IF CALL IS VALID (to avoid revert)
      try {
        await contract.callStatic.burnToken(
          row.address,
          row.rawBalance,
          JSON.stringify({ safe: true }),
          { value: feeWei }
        );
      } catch (checkErr: any) {
        console.warn(`⚠️ burnToken reverted in simulation for ${row.symbol}:`, checkErr.reason);
        continue;
      }

      // ✅ STEP 4 — SEND BURN TRANSACTION (pop-up)
      try {
        setStatus(`🔥 Burning ${row.symbol}... Confirm in wallet.`);
        console.log("🚀 Sending burn transaction", {
          token: row.address,
          amount: row.rawBalance.toString(),
          fee: feeWei.toString(),
        });

        const tx = await contract.burnToken(
          row.address,
          row.rawBalance,
          JSON.stringify({ safe: true }),
          {
            value: feeWei, // ✅ bigint, not string
            gasLimit: 300_000n,
          }
        );

        setStatus(`⏳ Waiting confirmation for ${row.symbol}...`);
        const receipt = await tx.wait();
        console.log(`✅ Burn success: ${row.symbol}`, receipt);
        setStatus(`✅ ${row.symbol} burned successfully!`);
      } catch (burnErr: any) {
        console.warn(`🔥 Burn failed for ${row.symbol}:`, burnErr.message);
        setStatus(`❌ Burn failed for ${row.symbol}: ${burnErr.message}`);
        continue;
      }
    }

    setStatus("✅ All tokens processed. Refreshing...");
    setSelected([]);
    loadTokens();
  } catch (e: any) {
    console.error("❌ Burn process failed:", e);
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
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">
      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">PUBS BURN</h1>
      <p className="text-sm text-gray-400 mb-4 text-center">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting wallet..."}
      </p>

      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">
        <div className="flex justify-between p-2 border-b border-[#00FF3C30] bg-[#111] sticky top-0 z-10">
          <div className="text-xs text-[#FF4A4A]">ALWAYS VERIFY BEFORE BURN</div>
          <button
            onClick={() =>
              selected.length === tokens.length
                ? setSelected([])
                : setSelected(tokens.map((t) => t.address))
            }
            className="text-xs text-[#00FF3C]"
          >
            {selected.length === tokens.length ? "Unselect All" : "Select All"}
          </button>
        </div>

        <div className="flex-1 max-h-[330px] overflow-y-auto divide-y divide-[#222] no-scrollbar">
          {tokens.map((t) => {
            const active = selected.includes(t.address);
            return (
              <button
                key={t.address}
                onClick={() =>
                  setSelected(active ? selected.filter((x) => x !== t.address) : [...selected, t.address])
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
                <div className={`text-sm ${t.isScam ? "text-[#FF4A4A]" : "text-[#00FF3C]"}`}>
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
            className="w-full py-3 bg-[#00FF3C] hover:bg-[#32FF67] text-black rounded-xl font-bold"
          >
            Burn {selected.length > 0 && `(${selected.length})`}
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
          onClick={shareWarpcast}
          className="mt-4 w-full max-w-sm py-3 bg-[#00FF3C] hover:bg-[#32FF67] rounded-xl font-semibold text-black"
        >
          📣 Share on Feed
        </button>
      )}

      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
