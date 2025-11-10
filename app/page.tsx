"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount, useWalletClient } from "wagmi";
import { encodeFunctionData, erc20Abi } from "viem";
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
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const loadTokens = async () => {
    setStatus("Fetching tokens...");
    if (!address) return;

    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    if (!key) {
      setStatus("❗ Masukkan NEXT_PUBLIC_ALCHEMY_KEY dulu");
      return;
    }

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

    const json = await res.json();
    const list = json?.result?.tokenBalances ?? [];
    setTokens(list);
    setStatus("✅ Token loaded");
  };

  const burnSelected = async () => {
    try {
      if (!walletClient || selected.length === 0) return;

      setStatus("🔥 Preparing batch burn...");

      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);

      let calls: any[] = [];

      for (const token of selected) {
        const amount = ethers.parseUnits("100000000000", 18); // BURN ALL TOKEN
        const [feeWei] = await contract.quoteErc20Fee(token, amount);

        calls.push({
          to: CONTRACT,
          data: contract.interface.encodeFunctionData("burnToken", [
            token,
            amount,
            JSON.stringify({ source: "miniapp", batch: true }),
          ]),
          value: feeWei,
        });
      }

      const tx = await (walletClient as any).sendCalls({ calls });

      setStatus("⏳ Waiting confirmation...");
      await provider.waitForTransaction(tx);
      setStatus("✅ Burn complete!");
    } catch (err: any) {
      setStatus("❌ " + err.message);
    }
  };

  return (
    <div className="p-6 text-white bg-[#1e1e1e] min-h-screen">
      <h1 className="text-4xl font-bold mb-4">PUBS BURN (Wagmi Version)</h1>

      {!isConnected && <p>Connecting Wallet...</p>}
      {isConnected && <p>Wallet: {address}</p>}

      <button onClick={loadTokens} className="mt-4 px-4 py-2 bg-blue-600 rounded">
        Load Tokens
      </button>

      <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
        {tokens.map((t) => {
          const checked = selected.includes(t.contractAddress);
          return (
            <button
              key={t.contractAddress}
              onClick={() =>
                setSelected(
                  checked
                    ? selected.filter((x) => x !== t.contractAddress)
                    : [...selected, t.contractAddress]
                )
              }
              className="block w-full p-3 rounded bg-[#2c2c2c] hover:bg-[#383838]"
            >
              {checked ? "✅ " : ""}{t.contractAddress}
            </button>
          );
        })}
      </div>

      <button
        onClick={burnSelected}
        className="mt-4 w-full py-3 bg-red-600 rounded shadow"
      >
        🔥 Burn Selected
      </button>

      <p className="mt-3 text-gray-300">{status}</p>
    </div>
  );
}
