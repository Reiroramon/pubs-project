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

  // POPUP STATES (BOTTOM SHEET)
  const [showApprovePopup, setShowApprovePopup] = useState(false);
  const [showBurnPopup, setShowBurnPopup] = useState(false);
  const [tokensToApprove, setTokensToApprove] = useState<any[]>([]);
  const [tokensToBurn, setTokensToBurn] = useState<any[]>([]);

  // INIT
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    if (!isConnected || !address) return;
    const t = setTimeout(loadTokens, 400);
    return () => clearTimeout(t);
  }, [isConnected, address]);

  // LOAD TOKENS
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
          const priceRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${t.contractAddress}`
          )
            .then((r) => r.json())
            .catch(() => null);

          const price = priceRes?.pairs?.[0]?.priceUsd ?? null;
          const logoUrl =
            priceRes?.pairs?.[0]?.info?.imageUrl ?? logo ?? "/token.png";

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

  // APPROVE 1 TOKEN INSIDE POPUP
  const approveSingleToken = async (token: any) => {
    try {
      const provider = new ethers.BrowserProvider(
        (sdk as any).wallet.ethProvider as any
      );
      const signer = await provider.getSigner();
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      setStatus(`Approving ${token.symbol}...`);

      const tokenContract = new ethers.Contract(
        token.address,
        ERC20_ABI,
        signer
      );
      const tx = await tokenContract.approve(CONTRACT, token.rawBalance);

      await rpc.waitForTransaction(tx.hash);

      setApprovedTokens((prev) => [...prev, token.address]);

      // CLOSE POPUP IF ALL APPROVED
      const allApproved = selected.every((addr) =>
        [...approvedTokens, token.address].includes(addr)
      );

      if (allApproved) setShowApprovePopup(false);
    } catch (err) {
      console.error(err);
      setStatus("Approve canceled or failed");
      setShowApprovePopup(false);
    }
  };

  // BURN FUNCTION
  const burnAll = async () => {
    try {
      const provider = new ethers.BrowserProvider(
        (sdk as any).wallet.ethProvider as any
      );
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row || row.rawBalance === 0n) continue;

        setStatus(`🔥 Burning ${row.symbol}...`);

        let feeWei = ethers.parseUnits("0.0001", "ether");
        try {
          const [f] = await contract.quoteErc20Fee(
            row.address,
            row.rawBalance
          );
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
      }

      setShowBurnPopup(false);
      setStatus("🔥 Burn completed");
      loadTokens();
    } catch (err) {
      console.error(err);
      setShowBurnPopup(false);
      setStatus("Burn canceled or failed");
    }
  };

  //
  // ---------------- UI START ----------------
  //

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA] px-4 py-6 flex flex-col items-center overflow-hidden">
      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">
        PUBS BURN
      </h1>
      <p className="text-sm text-gray-400 mb-4 text-center">
        {address
          ? `${address.slice(0, 6)}…${address.slice(-4)}`
          : "Connecting wallet..."}
      </p>

      {/* CARD */}
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
                  setSelected(
                    active
                      ? selected.filter((x) => x !== t.address)
                      : [...selected, t.address]
                  )
                }
                className={`flex items-center w-full px-4 py-3 hover:bg-[#1A1F1A] transition ${
                  active ? "bg-[#132A18]" : ""
                }`}
              >
                <img
                  src={t.logoUrl}
                  className="w-7 h-7 rounded-full mr-3"
                />

                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate flex items-center gap-1">
                    {t.name}
                    {t.isScam && (
                      <span className="text-[10px] text-[#FF4A4A]">🚨</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {t.symbol} • {Number(t.balance).toFixed(4)}
                  </div>
                </div>

                <div
                  className={`text-sm ${
                    t.isScam ? "text-[#FF4A4A]" : "text-[#00FF3C]"
                  }`}
                >
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
          {/* === MAIN ACTION BUTTON === */}
          <button
            onClick={() => {
              const allApproved = selected.every((s) =>
                approvedTokens.includes(s)
              );

              if (!allApproved) {
                setTokensToApprove(
                  selected.map((addr) => tokens.find((t) => t.address === addr))
                );
                setShowApprovePopup(true);
              } else {
                setTokensToBurn(
                  selected.map((addr) => tokens.find((t) => t.address === addr))
                );
                setShowBurnPopup(true);
              }
            }}
            className={`w-full py-3 rounded-xl font-bold ${
              selected.every((s) => approvedTokens.includes(s))
                ? "bg-[#00FF3C] hover:bg-[#32FF67] text-black"
                : "bg-[#FFB800] hover:bg-[#FFCC33] text-black"
            }`}
          >
            {selected.length === 0
              ? "Select token first"
              : selected.every((s) => approvedTokens.includes(s))
              ? `Burn Now (${selected.length})`
              : `Approve Selected (${selected.length})`}
          </button>

          {/* REFRESH */}
          <button
            onClick={loadTokens}
            className="w-full py-3 bg-[#2F2F2F] hover:bg-[#3A3A3A] rounded-xl font-semibold text-[#EAEAEA]"
          >
            Scan / Refresh Tokens
          </button>
        </div>
      </div>

      {/* APPROVE POPUP (BOTTOM SHEET) */}
      {showApprovePopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex flex-col justify-end z-50">
          <div className="bg-[#111] w-full rounded-t-3xl p-5 border-t border-[#00FF3C50] h-[50vh] overflow-y-auto">
            <h2 className="text-[#00FF3C] text-lg font-bold mb-3">
              Approve Tokens
            </h2>

            {tokensToApprove.map((t) => (
              <button
                key={t.address}
                className={`w-full py-2 mb-2 rounded-lg ${
                  approvedTokens.includes(t.address)
                    ? "bg-gray-600 text-white"
                    : "bg-[#00FF3C] text-black"
                }`}
                onClick={() => approveSingleToken(t)}
                disabled={approvedTokens.includes(t.address)}
              >
                {approvedTokens.includes(t.address)
                  ? `Approved ${t.symbol}`
                  : `Approve ${t.symbol}`}
              </button>
            ))}

            <button
              className="w-full py-2 bg-[#333] text-white rounded-lg mt-3"
              onClick={() => setShowApprovePopup(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* BURN POPUP (BOTTOM SHEET) */}
      {showBurnPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex flex-col justify-end z-50">
          <div className="bg-[#111] w-full rounded-t-3xl p-5 border-t border-[#00FF3C50] h-[50vh] overflow-y-auto">
            <h2 className="text-[#00FF3C] text-lg font-bold mb-3">
              Burn Tokens
            </h2>

            {tokensToBurn.map((t) => (
              <div
                key={t.address}
                className="text-white text-sm mb-1"
              >
                {t.symbol}
              </div>
            ))}

            <button
              className="w-full py-2 bg-[#00FF3C] text-black rounded-lg mt-3"
              onClick={async () => {
                setShowBurnPopup(false);
                await burnAll();
              }}
            >
              Confirm Burn
            </button>

            <button
              className="w-full py-2 bg-[#333] text-white rounded-lg mt-3"
              onClick={() => setShowBurnPopup(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {lastBurnTx && (
        <button
          onClick={() => {
            sdk.actions.openUrl(
              `https://warpcast.com/~/compose?text=${encodeURIComponent(
                "I just cleaned my wallet by burning scam tokens ♻️🔥"
              )}`
            );
          }}
          className="mt-4 w-full max-w-sm py-3 bg-[#00FF3C] hover:bg-[#32FF67] rounded-xl font-semibold text-black"
        >
          📣 Share on Feed
        </button>
      )}

      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
