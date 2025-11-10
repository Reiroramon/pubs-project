"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ethers } from "ethers";
import axios from "axios";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;

const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) public view returns (uint256 feeWei, uint8 decimals_)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];

const stableWatchlist = [
  "USDC", "USDT", "DAI", "CBETH", "WBTC", "WETH", "TUSD", "FDUSD", "PYUSD", "LUSD"
];

export default function HomePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletTokens, setWalletTokens] = useState<any[]>([]);
  const [tokenAddr, setTokenAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [scanResult, setScanResult] = useState<any | null>(null);

  useEffect(() => {
    sdk.actions.ready();
    (async () => {
      try {
        const acc = await sdk.wallet.ethProvider.request({ method: "eth_requestAccounts" });
        setWalletAddress(acc[0]);
      } catch {
        setWalletAddress(null);
      }
    })();
  }, []);

  const fetchWalletTokens = async () => {
    if (!walletAddress) return;
    setStatus("🔄 Fetching tokens...");

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_ALCHEMY_BASE}/getTokenBalances`,
        { address: walletAddress, withMetadata: true }
      );

      let list = res.data.tokenBalances
        .filter((t: any) => t.tokenBalance !== "0x0")
        .map((t: any) => ({
          address: t.contractAddress,
          symbol: t.metadata?.symbol ?? "?",
          name: t.metadata?.name ?? "Unknown",
          decimals: t.metadata?.decimals ?? 18,
          displayBalance: Number(
            Number(t.tokenBalance) / 10 ** (t.metadata?.decimals ?? 18)
          ).toFixed(3),
        }))
        .filter((t: any) => !stableWatchlist.includes(t.symbol.toUpperCase()));

      // Fetch logos from CoinGecko
      const withLogos = await Promise.all(
        list.map(async (t: any) => {
          try {
            const cg = await axios.get(
              `https://api.coingecko.com/api/v3/coins/base/contract/${t.address}`
            );
            return { ...t, logo: cg.data.image.small };
          } catch {
            return { ...t, logo: "/token.png" }; // fallback icon
          }
        })
      );

      setWalletTokens(withLogos);
      setStatus("");
    } catch {
      setStatus("⚠️ Failed to load tokens.");
    }
  };

  useEffect(() => {
    if (walletAddress) fetchWalletTokens();
  }, [walletAddress]);

  const autoScan = async () => {
    setStatus("🔍 Running security scan...");
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_GOPLUS_API}?contract_addresses=${tokenAddr}`
      );
      const info = res.data.result[tokenAddr.toLowerCase()];
      if (!info) return setStatus("⚠️ No scan data.");

      const data = {
        honeypot: info.is_honeypot === "1",
        buyTax: Number(info.buy_tax ?? 0),
        sellTax: Number(info.sell_tax ?? 0),
      };

      setScanResult(data);

      if (data.honeypot) return setStatus("🚨 HONEYPOT DETECTED!");
      if (data.sellTax > 10) return setStatus("⚠️ High sell tax, suspicious.");
      setStatus("✅ Token seems safe enough to burn.");
    } catch {
      setStatus("⚠️ Scan failed.");
    }
  };

  const burn = async () => {
    try {
      setStatus("🔥 Preparing burn...");
      const provider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const tokenAmount = ethers.parseUnits(amount, 18);

      const summary = JSON.stringify({ automatedScan: true, risk: scanResult });
      const [feeWei] = await contract.quoteErc20Fee(tokenAddr, tokenAmount);
      const tx = await contract.burnToken(tokenAddr, tokenAmount, summary, { value: feeWei });

      setStatus("⏳ Confirming...");
      await tx.wait();
      setTxHash(tx.hash);
      setStatus("✅ Burn successful!");
    } catch (err: any) {
      setStatus("❌ " + err.message);
    }
  };

  if (!walletAddress) return <p className="text-white text-center mt-20">Loading wallet...</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ backgroundImage: "url('/mbekground.jpg')" }}>

      <h1 className="text-8xl font-bold text-[#00ff00] drop-shadow-[0_0_12px_#00ff00]">PUBS BURN</h1>
      <p className="text-[#00ff00] font-bold text-sm">Wallet: {walletAddress}</p>

      {/* TOKEN LIST */}
      <div className="bg-black/60 p-4 rounded-xl w-96 border border-[#00ff00]/30 shadow-[0_0_12px_#00ff00]">
        <h2 className="text-sm text-[#00ff00] mb-3 font-bold">Your Tokens</h2>
        <div className="max-h-60 overflow-y-auto space-y-3">
          {walletTokens.map((t, i) => (
            <div key={i}
              onClick={() => { setTokenAddr(t.address); setAmount(t.displayBalance); }}
              className="flex items-center justify-between bg-black/40 border border-gray-700 p-3 rounded-lg hover:border-[#00ff00] cursor-pointer transition">
              <div className="flex items-center gap-3">
                <img src={t.logo} className="w-6 h-6 rounded-full" />
                <span className="text-gray-200 text-sm">{t.symbol} — {t.displayBalance}</span>
              </div>
              <span className="text-xs text-gray-500">{t.address.slice(0, 6)}…{t.address.slice(-4)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FORM */}
      <div className="bg-black/50 p-6 rounded-xl w-96 text-center border border-[#00ff00]/30 shadow-[0_0_15px_#00ff00]">
        <input type="text" value={tokenAddr} placeholder="Token Address"
          onChange={(e) => setTokenAddr(e.target.value)} className="w-full p-2 mb-2 rounded-lg text-black" />

        <input type="text" value={amount} placeholder="Amount"
          onChange={(e) => setAmount(e.target.value)} className="w-full p-2 mb-3 rounded-lg text-black" />

        <button onClick={autoScan} className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg mb-2">
          🔍 Auto Scan (Anti Rugcheck)
        </button>

        <button onClick={burn} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg">
          🔥 Burn Now
        </button>

        <p className="mt-4 text-sm text-gray-300">{status}</p>

        {txHash && (
          <a href={`https://basescan.org/tx/${txHash}`} target="_blank" className="text-[#00ff00] underline text-sm font-bold mt-2 block">
            View Transaction 🔗
          </a>
        )}
      </div>

      <footer className="text-gray-500 text-xs mt-4">Burn Rug. Save Users.</footer>
    </div>
  );
}
