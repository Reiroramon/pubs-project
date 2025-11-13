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
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);

  // overlay untuk matikan putih dari wallet popup
  const [walletPopupOpen, setWalletPopupOpen] = useState(false);

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
          )
            .then((r) => r.json())
            .catch(() => null);

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

  // APPROVE
  const approveToken = async (token: any) => {
    try {
      setStatus(`Approving ${token.symbol}...`);
      setWalletPopupOpen(true); // 🔥 aktifkan overlay anti putih

      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
      const signer = await provider.getSigner();

      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);

      const tx = await tokenContract.approve(CONTRACT, token.rawBalance);
      setStatus("Waiting confirm…");

      await rpc.waitForTransaction(tx.hash);

      setApprovedTokens((prev) => [...prev, token.address]);
      setStatus(`Approved ${token.symbol}`);
    } catch {
      setStatus("Approve canceled or failed");
    } finally {
      setWalletPopupOpen(false); // 🔥 overlay off
    }
  };

  // BURN
  const burn = async () => {
    if (!selected.length) return setStatus("Select token first");

    try {
      setStatus("Burning…");
      setWalletPopupOpen(true); // 🔥 ON overlay

      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      for (const tokenAddress of selected) {
        const token = tokens.find((t) => t.address === tokenAddress);
        if (!token) continue;

        let feeWei = ethers.parseUnits("0.0001", "ether");
        try {
          const [f] = await contract.quoteErc20Fee(token.address, token.rawBalance);
          if (f > 0n) feeWei = f;
        } catch {}

        const iface = new ethers.Interface(ABI);
        const data = iface.encodeFunctionData("burnToken", [
          token.address,
          token.rawBalance,
          JSON.stringify({ safe: true }),
        ]);

        const tx = await signer.sendTransaction({
          to: CONTRACT,
          data,
          value: feeWei,
          gasLimit: 350_000n,
        });

        await rpc.waitForTransaction(tx.hash);
      }

      setStatus("🔥 Burn complete");
      loadTokens();
    } catch (err) {
      console.error(err);
      setStatus("Burn failed");
    } finally {
      setWalletPopupOpen(false); // 🔥 OFF overlay
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">

      {/* 🔥 Overlay anti putih */}
      {walletPopupOpen && <div className="wallet-overlay"></div>}

      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">
        PUBS BURN
      </h1>
      <p className="text-sm text-gray-400 mb-4 text-center">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting..."}
      </p>

      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">

        <div className="flex justify-between p-2 border-b border-[#00FF3C30] bg-[#111] sticky top-0">
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

        <div className="flex-1 max-h-[330px] overflow-y-auto divide-y divide-[#222]">
          {tokens.map((t) => {
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
                className={`flex items-center w-full px-4 py-3 hover:bg-[#1A1F1A] ${
                  active ? "bg-[#132A18]" : ""
                }`}
              >
                <img src={t.logoUrl} className="w-7 h-7 rounded-full mr-3" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate">
                    {t.name}
                    {t.isScam && <span className="text-[10px] text-red-400 ml-1">🚨</span>}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.symbol} • {Number(t.balance).toFixed(4)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-[#111] flex flex-col gap-3">
          <button
            onClick={async () => {
              const unapproved = selected.filter((s) => !approvedTokens.includes(s));
              if (unapproved.length > 0) {
                const first = tokens.find((t) => t.address === unapproved[0]);
                if (first) await approveToken(first);
              } else {
                await burn();
              }
            }}
            className="w-full py-3 rounded-xl font-bold bg-[#00FF3C] text-black"
          >
            {selected.length === 0
              ? "Select Token"
              : selected.every((s) => approvedTokens.includes(s))
              ? "Burn Now"
              : "Approve Selected"}
          </button>

          <button
            onClick={loadTokens}
            className="w-full py-3 bg-[#2F2F2F] rounded-xl"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
