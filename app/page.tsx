"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { ethers } from "ethers";
import axios from "axios";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ABI = [
  "function burnToken(address tokenAddress,uint256 amount) payable",
  "function burnNFT(address nftAddress,uint256 tokenId) payable",
];

export default function HomePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [tokenAddr, setTokenAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");

 useEffect(() => {
  sdk.actions.ready();

  (async () => {
    const accounts = await sdk.wallet.ethProvider.request({
  method: "eth_accounts",
});
setWalletAddress(accounts[0]);

  })();
}, []);


  const scanToken = async () => {
    setStatus("🔍 Scanning token...");
    try {
      const res = await axios.get(
        `https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=${tokenAddr}&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
      );
      setStatus(res.data ? "✅ Scan complete!" : "⚠️ Token not found");
    } catch {
      setStatus("⚠️ Unable to scan token");
    }
  };

  const burnToken = async () => {
  try {
    setStatus("🔥 Sending burn transaction...");

    const provider = new ethers.BrowserProvider(sdk.wallet.ethProvider);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    const fee = ethers.parseEther("0.001");
    const tx = await contract.burnToken(
      tokenAddr,
      ethers.parseUnits(amount, 18),
      { value: fee }
    );

    setStatus("⏳ Waiting for confirmation...");
    await tx.wait();

    setTxHash(tx.hash);
    setStatus("✅ Burn successful!");
  } catch (err: any) {
    setStatus("❌ Error: " + err.message);
  }
};


  if (!walletAddress) {
    return <div className="text-center text-white mt-20">Loading Wallet...</div>;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-cover bg-center"
      style={{ backgroundImage: "url('/mbekground.jpg')" }}
    >
      <h1 className="text-9xl font-bold text-[#00ff00] drop-shadow-[0_0_12px_#00ff00]">
        PUBS BURN
      </h1>

      <p className="text-[#00ff00] font-bold text-sm">Wallet: {walletAddress}</p>

      <div className="bg-black/50 p-6 rounded-xl w-96 text-center border border-[#00ff00]/30 shadow-[0_0_15px_#00ff00]">
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

        <button onClick={scanToken} className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg mb-2">
          🔍 Scan Token
        </button>

        <button onClick={burnToken} className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg">
          🔥 Burn Now
        </button>

        <p className="mt-4 text-sm text-gray-300">{status}</p>

        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00ff00] underline text-sm font-bold drop-shadow-[0_0_10px_#00ff00] mt-2 inline-block"
          >
            View on BaseScan 🔗
          </a>
        )}
      </div>
    </div>
  );
}
