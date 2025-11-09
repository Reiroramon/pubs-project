"use client"; 
import { Bungee_Shade } from "next/font/google";
const fireFont = Bungee_Shade({
  subsets: ["latin"],
  weight: "400",
});
import React, { useState } from "react";
import { motion } from "framer-motion";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import axios from "axios";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function burnToken(address tokenAddress,uint256 amount) payable",
  "function burnNFT(address nftAddress,uint256 tokenId) payable",
];

function PUBSBurner() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const [tokenAddr, setTokenAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");

  const connectFarcaster = async () => {
    if (!authenticated) await login();
  };

  const scanToken = async () => {
    setStatus("🔍 Scanning token...");
    try {
      const res = await axios.get(
        `https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=${tokenAddr}&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
      );
      setStatus(res.data ? "✅ Scan complete!" : "⚠️ Token not found");
    } catch {
      setStatus("⚠️ Unable to scan token (check address or API key)");
    }
  };

  const burnToken = async () => {
    try {
      if (!wallets.length) throw new Error("No wallet connected");
      setStatus("🔥 Sending burn transaction...");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const fee = ethers.parseEther("0.001");
      const tx = await contract.burnToken(tokenAddr, ethers.parseUnits(amount, 18), { value: fee });
      setStatus("⏳ Waiting for confirmation...");
      await tx.wait();
      setTxHash(tx.hash);
      setStatus("✅ Burn successful!");
    } catch (err: any) {
      console.error(err);
      setStatus("❌ Error: " + (err?.message || "Unknown error"));
    }
  };

  if (!ready) return <div className="text-center text-white">Loading Privy...</div>;

  return (
    <div
  className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-cover bg-center"
  style={{ backgroundImage: "url('/mbekground.jpg')" }}
>
<h1
  className="text-9xl font-bold text-[#00ff00] drop-shadow-[0_0_10px_#00ff00]"
  style={{
    WebkitTextStroke: "2px #ffffff", // outline tebal
    color: "transparent",
    textShadow: "0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00",
  }}
>
  PUBS BURN
</h1>

  {!authenticated ? (
  <button
    onClick={connectFarcaster}
    className="px-6 py-3 rounded-lg font-bold text-white border-2 border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-all duration-300 drop-shadow-[0_0_10px_#00ff00]"
    style={{
      WebkitTextStroke: "0.3px #00ff00",
      textShadow: "0 0 6px #00ff00, 0 0 10px #00ff00",
    }}
  >
    Connect Wallet
  </button>
) : (
  <div className="bg-black/50 p-6 rounded-xl w-96 text-center border border-[#00ff00]/30 shadow-[0_0_15px_#00ff00]">
    <p
      className="text-sm mb-3 font-bold"
      style={{
        color: "#00ff00",
        WebkitTextStroke: "0.5px #00ff00",
        textShadow: "0 0 8px #00ff00, 0 0 12px #00ff00",
      }}
    >
      Connected as:{" "}
      <span className="text-[#00ff00] font-bold drop-shadow-[0_0_10px_#00ff00]">
        {user?.wallet?.address}
      </span>
    </p>


          <input
            type="text"
            placeholder="Token Address"
            value={tokenAddr}
            onChange={(e) => setTokenAddr(e.target.value)}
            className="w-full p-2 mb-3 rounded-lg text-black"
          />

          <input
            type="text"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 mb-3 rounded-lg text-black"
          />

          <button
            onClick={scanToken}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg mb-2"
          >
            🔍 Scan Token
          </button>

          <button
            onClick={burnToken}
            className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg"
          >
            🔥 Burn Now
          </button>

          <p className="mt-4 text-sm text-gray-300">{status}</p>

          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-sm"
            >
              View on BaseScan
            </a>
          )}

          <button
            onClick={() => logout()}
            className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
          >
            Logout
          </button>
        </div>
      )}

      <footer className="text-gray-500 text-xs mt-4">Protect Users Burn Scams</footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#00ff9d",
        },
        loginMethods: ["wallet", "farcaster"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <PUBSBurner />
    </PrivyProvider>
  );
}
