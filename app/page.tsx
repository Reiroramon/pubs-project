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

  // APPROVE 1 TOKEN INSIDE POPUP (tile click)
  const approveSingleToken = async (token: any) => {
  try {
    setStatus(`Approving ${token.symbol}...`);

    // WAJIB untuk Farcaster Miniapp
    const signer = await (sdk as any).wallet.getSigner();

    // untuk wait tx (tidak mengirim transaksi)
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    const tokenContract = new ethers.Contract(
      token.address,
      ERC20_ABI,
      signer
    );

    // 🚀 popup wallet muncul disini
    const tx = await tokenContract.approve(CONTRACT, token.rawBalance);

    setStatus(`Waiting confirmation…`);
    await rpc.waitForTransaction(tx.hash);

    // tandai sebagai approved
    setApprovedTokens(prev => [...prev, token.address]);

    // auto close jika semua approved
    const allApproved = selected.every(addr =>
      [...approvedTokens, token.address].includes(addr)
    );
    if (allApproved) setShowApprovePopup(false);

  } catch (err: any) {
    console.error(err);

    if (err?.code === 4001) {
      setStatus("User rejected approve");
    } else {
      setStatus("Approve failed");
    }

    // popup tetap stay (jangan ditutup)
  }
};

  // BURN ALL SELECTED (used by burn popup)
 const burnAll = async () => {
  try {
    if (!selected.length) return setStatus("No tokens selected");

    setStatus("🔥 Starting burn…");

    // signer miniapp (WAJIB)
    const signer = await (sdk as any).wallet.getSigner();
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

    for (const tokenAddress of selected) {
      const row = tokens.find(t => t.address === tokenAddress);
      if (!row) continue;

      if (!approvedTokens.includes(tokenAddress)) {
        setStatus(`❌ ${row.symbol} not approved`);
        return;
      }

      setStatus(`🔥 Burning ${row.symbol}…`);

      // ambil fee
      let feeWei = ethers.parseUnits("0.0001", "ether");
      try {
        const [f] = await contract.quoteErc20Fee(row.address, row.rawBalance);
        if (f > 0n) feeWei = f;
      } catch {}

      // encode burn
      const iface = new ethers.Interface(ABI);
      const data = iface.encodeFunctionData("burnToken", [
        row.address,
        row.rawBalance,
        JSON.stringify({ safe: true }),
      ]);

      // 🚀 popup wallet untuk burn muncul di sini
      const tx = await signer.sendTransaction({
        to: CONTRACT,
        data,
        value: feeWei,
        gasLimit: 350_000n,
      });

      setStatus(`⏳ Waiting ${row.symbol} tx…`);
      await rpc.waitForTransaction(tx.hash);
      setStatus(`✅ Burned ${row.symbol}`);
    }

    setShowBurnPopup(false);
    setStatus("🔥 All tokens burned!");
    loadTokens();

  } catch (err) {
    console.error(err);
    setStatus("Burn failed or canceled");
    setShowBurnPopup(false);
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
                  setSelected(
                    active ? selected.filter((x) => x !== t.address) : [...selected, t.address]
                  )
                }
                className={`flex items-center w-full px-4 py-3 hover:bg-[#1A1F1A] transition ${active ? "bg-[#132A18]" : ""}`}
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
          {/* === MAIN ACTION BUTTON => open popup (approve or burn) */}
          <button
            onClick={() => {
              const allApproved = selected.every((s) => approvedTokens.includes(s));
              if (!allApproved) {
                // build tokensToApprove (preserve original token objects)
                const toApprove = selected
                  .map((addr) => tokens.find((t) => t.address === addr))
                  .filter(Boolean);
                setTokensToApprove(toApprove);
                setShowApprovePopup(true);
              } else {
                const toBurn = selected
                  .map((addr) => tokens.find((t) => t.address === addr))
                  .filter(Boolean);
                setTokensToBurn(toBurn);
                setShowBurnPopup(true);
              }
            }}
            className={`w-full py-3 rounded-xl font-bold ${selected.every((s) => approvedTokens.includes(s)) ? "bg-[#00FF3C] hover:bg-[#32FF67] text-black" : "bg-[#FFB800] hover:bg-[#FFCC33] text-black"}`}
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

      {/* === APPROVE BOTTOM SHEET (KONDO STYLE, TILE LIST) === */}
      {/* APPROVE BOTTOM SHEET */}
{showApprovePopup && (
  <>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />

    <div className="fixed inset-0 flex flex-col justify-end z-50">
      <div className="w-full h-[50vh] bg-[#111] rounded-t-3xl p-5 border-t border-[#00FF3C40] shadow-xl overflow-y-auto">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[#00FF3C] text-lg font-bold">Approve Tokens</h2>
            <div className="text-xs text-gray-400">Tap to approve (one by one)</div>
          </div>
          <button onClick={() => setShowApprovePopup(false)} className="text-gray-300 text-sm">Close</button>
        </div>

        <div className="space-y-3">
          {tokensToApprove.map((t) => (
            <div
              key={t.address}
              onClick={() => !approvedTokens.includes(t.address) && approveSingleToken(t)}
              className={`flex items-center p-3 rounded-2xl cursor-pointer transition border
                ${approvedTokens.includes(t.address)
                  ? "bg-[#0F0F0F] border-[#00FF3C40] opacity-70"
                  : "bg-[#1A1A1A] border-[#333] hover:border-[#00FF3C]"
                }`}
            >
              <img src={t.logoUrl} className="w-10 h-10 rounded-full mr-3" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold truncate">{t.symbol}</div>
                <div className="text-gray-400 text-xs truncate">{t.name}</div>
              </div>

              <div className={`px-3 py-1 rounded-lg text-sm 
                ${approvedTokens.includes(t.address)
                  ? "bg-gray-700 text-gray-300"
                  : "bg-[#00FF3C] text-black"
                }`}
              >
                {approvedTokens.includes(t.address) ? "Approved" : "Approve"}
              </div>
            </div>
          ))}
        </div>

        <button className="w-full py-3 bg-[#333] text-white rounded-xl mt-5"
          onClick={() => setShowApprovePopup(false)}
        >
          Cancel
        </button>

      </div>
    </div>
  </>
)}


      {/* === BURN BOTTOM SHEET (KONDO STYLE) === */}
      {showBurnPopup && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 pointer-events-none" />
          <div className="fixed inset-0 flex flex-col justify-end z-50 pointer-events-none">
            <div className="pointer-events-auto w-full h-[50vh] bg-[#111] rounded-t-3xl p-5 border-t border-[#00FF3C40] shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[#00FF3C] text-lg font-bold">Burn Tokens</h2>
                  <div className="text-xs text-gray-400">Confirm burning the selected tokens</div>
                </div>
                <button
                  onClick={() => setShowBurnPopup(false)}
                  className="text-gray-300 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {tokensToBurn.map((t) => (
                  <div key={t.address} className="flex items-center p-3 rounded-2xl bg-[#1A1A1A] border border-[#333]">
                    <img src={t.logoUrl} className="w-10 h-10 rounded-full mr-3" />
                    <div className="flex-1 text-white">{t.symbol}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <button
                  className="w-full py-3 bg-[#00FF3C] text-black rounded-xl font-semibold"
                  onClick={async () => {
                    setShowBurnPopup(false);
                    await burnAll();
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
          </div>
        </>
      )}

      {lastBurnTx && (
        <button
          onClick={() => {
            sdk.actions.openUrl(
              `https://warpcast.com/~/compose?text=${encodeURIComponent(
                "I just cleaned my wallet by burning scam tokens using PUBS BURN ♻️🔥 #SafeOnchain"
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
