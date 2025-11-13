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

  // Popup states
  const [showApprovePopup, setShowApprovePopup] = useState(false);
  const [tokensToApprove, setTokensToApprove] = useState<any[]>([]);
  const [showBurnPopup, setShowBurnPopup] = useState(false);
  const [tokensToBurn, setTokensToBurn] = useState<any[]>([]);

  // Init SDK
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Load tokens when connected
  useEffect(() => {
    if (!isConnected || !address) return;
    const t = setTimeout(loadTokens, 400);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  // Load tokens
  const loadTokens = async () => {
    if (!address) return;

    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    if (!key) return setStatus("⚠️ ALCHEMY KEY missing");

    try {
      setStatus("⏳ Scanning tokens...");

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
          const metaRes = await fetch(
            `https://base-mainnet.g.alchemy.com/v2/${key}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                id: 2,
                jsonrpc: "2.0",
                method: "alchemy_getTokenMetadata",
                params: [t.contractAddress],
              }),
            }
          );

          const meta = await metaRes.json();
          const { decimals, name, symbol, logo } = meta?.result ?? {};
          const decimalsSafe = decimals ?? 18;

          const balance = ethers.formatUnits(t.tokenBalance, decimalsSafe);

          const logoUrl = logo ?? "/token.png";

          return {
            address: t.contractAddress,
            name: name || symbol || "Unknown",
            symbol: symbol || "TKN",
            decimals: decimalsSafe,
            balance,
            rawBalance: BigInt(t.tokenBalance),
            logoUrl,
          };
        })
      );

      setTokens(final.filter((t) => Number(t.balance) > 0));
      setStatus("✅ Ready");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to scan");
    }
  };

  // Approve 1 token
  const approveSingleToken = async (token: any) => {
    try {
      setStatus(`Approving ${token.symbol}...`);

      const signer = await (sdk as any).wallet.getSigner();
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);

      const tx = await tokenContract.approve(CONTRACT, token.rawBalance);

      await rpc.waitForTransaction(tx.hash);

      setApprovedTokens((prev) => [...prev, token.address]);

      setStatus(`Approved ${token.symbol}`);

      // auto close if finished
      const allDone = selected.every((x) =>
        [...approvedTokens, token.address].includes(x)
      );

      if (allDone) setShowApprovePopup(false);
    } catch (err) {
      console.error(err);
      setStatus("Approve canceled / failed");
    }
  };

  // Burn all
  const burnAll = async () => {
    try {
      const signer = await (sdk as any).wallet.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        setStatus(`Burning ${row.symbol}...`);

        let feeWei = ethers.parseUnits("0.0001", "ether");

        try {
          const [f] = await contract.quoteErc20Fee(row.address, row.rawBalance);
          if (f && f > 0n) feeWei = f;
        } catch {}

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
        setStatus(`Burned ${row.symbol}`);
      }

      setShowBurnPopup(false);
      loadTokens();
    } catch (err) {
      console.error(err);
      setStatus("Burn failed");
      setShowBurnPopup(false);
    }
  };

  //
  // UI BELOW
  //
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center">

      <h1 className="text-3xl font-bold text-[#00FF3C]">PUBS BURN</h1>
      <p className="text-gray-500 text-sm mb-4">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting..."}
      </p>

      {/* TOKEN LIST CARD */}
      <div className="w-full max-w-sm bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">

        <div className="p-2 bg-[#111] border-b border-[#00FF3C30] flex justify-between">
          <span className="text-xs text-red-400">ALWAYS VERIFY</span>

          <button
            onClick={() =>
              selected.length === tokens.length
                ? setSelected([])
                : setSelected(tokens.map((t) => t.address))
            }
            className="text-[#00FF3C] text-xs"
          >
            {selected.length === tokens.length ? "Unselect All" : "Select All"}
          </button>
        </div>

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
                  active ? "bg-[#132A18]" : "hover:bg-[#1A1F1A]"
                }`}
              >
                <img src={t.logoUrl} className="w-7 h-7 rounded-full mr-3" />

                <div className="flex-1">
                  <div className="text-white font-semibold truncate">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.symbol} • {Number(t.balance).toFixed(4)}
                  </div>
                </div>

                <div className="ml-3 w-5 h-5 border border-[#00FF3C] rounded flex items-center justify-center">
                  {active && <div className="w-3 h-3 bg-[#00FF3C] rounded" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3">
          {/* ACTION BUTTON */}
          <button
            onClick={() => {
              const allApproved = selected.every((addr) =>
                approvedTokens.includes(addr)
              );

              if (!allApproved) {
                const list = selected
                  .map((a) => tokens.find((t) => t.address === a))
                  .filter(Boolean);

                setTokensToApprove(list);
                setShowApprovePopup(true);
              } else {
                const list = selected
                  .map((a) => tokens.find((t) => t.address === a))
                  .filter(Boolean);

                setTokensToBurn(list);
                setShowBurnPopup(true);
              }
            }}
            className={`w-full py-3 rounded-xl font-bold ${
              selected.every((s) => approvedTokens.includes(s))
                ? "bg-[#00FF3C] text-black"
                : "bg-yellow-400 text-black"
            }`}
          >
            {selected.length === 0
              ? "Select token first"
              : selected.every((s) => approvedTokens.includes(s))
              ? `Burn Now (${selected.length})`
              : `Approve Selected (${selected.length})`}
          </button>

          <button
            onClick={loadTokens}
            className="w-full py-3 mt-3 bg-[#2F2F2F] text-white rounded-xl"
          >
            Refresh Tokens
          </button>
        </div>
      </div>

      {/* APPROVE POPUP */}
      {showApprovePopup && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 pointer-events-none" />

          <div className="fixed inset-0 flex flex-col justify-end z-50 pointer-events-none">
            <div className="pointer-events-auto bg-[#111] w-full h-[50vh] rounded-t-3xl p-5 border-t border-[#00FF3C40] overflow-y-auto">

              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[#00FF3C] text-lg font-bold">Approve Tokens</h2>
                <button className="text-gray-300" onClick={() => setShowApprovePopup(false)}>Close</button>
              </div>

              <div className="space-y-3">
                {tokensToApprove.map((t) => {
                  const done = approvedTokens.includes(t.address);
                  return (
                    <div
                      key={t.address}
                      onClick={() => !done && approveSingleToken(t)}
                      className={`flex items-center p-3 rounded-2xl cursor-pointer border
                        ${
                          done
                            ? "border-[#00FF3C40] bg-[#0F0F0F] opacity-70"
                            : "border-[#333] bg-[#1A1A1A] hover:border-[#00FF3C]"
                        }`}
                    >
                      <img src={t.logoUrl} className="w-10 h-10 rounded-full mr-3" />

                      <div className="flex-1">
                        <div className="text-white font-semibold">{t.symbol}</div>
                        <div className="text-gray-400 text-xs">{t.name}</div>
                      </div>

                      <div
                        className={`px-3 py-1 rounded-lg text-sm ${
                          done ? "bg-gray-700 text-gray-300" : "bg-[#00FF3C] text-black"
                        }`}
                      >
                        {done ? "Approved" : "Approve"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                className="w-full py-3 mt-5 bg-[#333] text-white rounded-xl"
                onClick={() => setShowApprovePopup(false)}
              >
                Cancel
              </button>

            </div>
          </div>
        </>
      )}

      {/* BURN POPUP */}
      {showBurnPopup && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 pointer-events-none" />

          <div className="fixed inset-0 flex flex-col justify-end z-50 pointer-events-none">
            <div className="pointer-events-auto bg-[#111] w-full h-[50vh] rounded-t-3xl p-5 border-t border-[#00FF3C40] overflow-y-auto">

              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[#00FF3C] text-lg font-bold">Burn Tokens</h2>
                <button className="text-gray-300" onClick={() => setShowBurnPopup(false)}>Close</button>
              </div>

              <div className="space-y-3">
                {tokensToBurn.map((t) => (
                  <div
                    key={t.address}
                    className="flex items-center p-3 rounded-2xl bg-[#1A1A1A] border border-[#333]"
                  >
                    <img src={t.logoUrl} className="w-10 h-10 rounded-full mr-3" />
                    <span className="text-white">{t.symbol}</span>
                  </div>
                ))}
              </div>

              <button
                className="w-full py-3 bg-[#00FF3C] text-black rounded-xl mt-5"
                onClick={() => {
                  setShowBurnPopup(false);
                  burnAll();
                }}
              >
                Confirm Burn
              </button>

              <button
                className="w-full py-3 bg-[#333] text-white rounded-xl mt-3"
                onClick={() => setShowBurnPopup(false)}
              >
                Cancel
              </button>

            </div>
          </div>
        </>
      )}

      <p className="text-gray-400 text-sm mt-4">{status}</p>
    </div>
  );
}
