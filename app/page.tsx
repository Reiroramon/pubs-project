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
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    if (!isConnected || !address) return;
    const t = setTimeout(loadTokens, 400);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  // ========================================================
  // 🔍 LOAD TOKENS
  // ========================================================
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

          return {
            address: t.contractAddress,
            name: name || symbol || "Unknown",
            symbol: symbol || "TKN",
            decimals: decimalsSafe,
            balance,
            rawBalance: BigInt(t.tokenBalance),
            logoUrl: logo || "/token.png",
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

  // ========================================================
  // 🔥 APPROVE ➜ BURN
  // ========================================================
  const burn = async () => {
    if (!selected.length) return setStatus("Select token(s) first");

    try {
      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);

      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        // --------------------------
        // STEP 1: APPROVE FIRST
        // --------------------------
        if (!approvedTokens.includes(tokenAddress)) {
          setStatus(`🧾 Approving ${row.symbol}...`);

          const tokenContract = new ethers.Contract(row.address, ERC20_ABI, signer);

          const approveTx = await tokenContract.approve(CONTRACT, row.rawBalance, {
            gasLimit: 200_000n,
          });

          setStatus("⏳ Waiting approval...");
          await approveTx.wait(); // ⚠️ DO NOT USE eth_getTransactionReceipt

          setApprovedTokens((prev) => [...prev, tokenAddress]);
          setStatus(`✅ ${row.symbol} approved! Click "Burn Now"`);
          return; // break dulu — user harus klik lagi
        }

        // --------------------------
        // STEP 2: GET FEE
        // --------------------------
        let feeWei = ethers.parseUnits("0.00001", "ether");
        try {
          const [f] = await contract.quoteErc20Fee(row.address, row.rawBalance);
          if (f > 0n) feeWei = f;
        } catch {
          console.warn("⚠️ Using fallback fee");
        }

        // --------------------------
        // STEP 3: BURN — FORCE POPUP
        // --------------------------
        setStatus(`🔥 Burning ${row.symbol}... Approve in wallet`);

        const iface = new ethers.Interface(ABI);
        const data = iface.encodeFunctionData("burnToken", [
          row.address,
          row.rawBalance,
          JSON.stringify({ ok: true }),
        ]);

        const burnTx = await signer.sendTransaction({
          to: CONTRACT,
          data,
          value: feeWei,
          gasLimit: 350_000n,
        });

        setStatus("⏳ Waiting confirmation...");
        await burnTx.wait();

        setStatus(`✅ Burned ${row.symbol} successfully!`);
      }

      loadTokens();
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err.message}`);
    }
  };

  // ========================================================
  // UI — BUTTON LOGIC
  // ========================================================
  const allApproved =
    selected.length > 0 && selected.every((s) => approvedTokens.includes(s));

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-2 text-[#00FF3C]">PUBS BURN</h1>

      <p className="text-sm text-gray-400 mb-4">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting..."}
      </p>

      {/* MAIN BOX */}
      <div className="w-full max-w-sm bg-[#151515] border border-[#00FF3C30] rounded-xl flex flex-col">

        {/* HEADER */}
        <div className="flex justify-between p-2 border-b border-[#00FF3C30] bg-[#111]">
          <span className="text-xs text-red-400">ALWAYS VERIFY BEFORE BURN</span>
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

        {/* TOKEN LIST */}
        <div className="max-h-[330px] overflow-y-auto divide-y divide-[#222]">
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
                className={`flex items-center px-4 py-3 w-full ${
                  active ? "bg-[#132A18]" : ""
                }`}
              >
                <img src={t.logoUrl} className="w-7 h-7 rounded-full mr-3" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-400">
                    {t.symbol} • {Number(t.balance).toFixed(4)}
                  </div>
                </div>

                <div className="ml-3 w-5 h-5 rounded border border-[#00FF3C] flex items-center justify-center">
                  {active && <div className="w-3 h-3 bg-[#00FF3C] rounded" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* ACTION */}
        <div className="p-3 flex flex-col gap-3 border-t border-[#00FF3C30] bg-[#111]">
          <button
            onClick={burn}
            className={`w-full py-3 rounded-xl font-bold ${
              allApproved
                ? "bg-[#00FF3C] hover:bg-[#32FF67] text-black"
                : "bg-[#FFB800] hover:bg-[#FFCC33] text-black"
            }`}
          >
            {selected.length === 0
              ? "Select Token First"
              : allApproved
              ? `Burn Now (${selected.length})`
              : `Approve Selected (${selected.length})`}
          </button>

          <button
            onClick={loadTokens}
            className="w-full py-3 bg-[#333] hover:bg-[#444] rounded-xl font-semibold"
          >
            Scan / Refresh Tokens
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
