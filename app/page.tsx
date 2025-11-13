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
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlaySuccess, setOverlaySuccess] = useState("");

  // 🔥 overlay transparan anti blank putih
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);

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
      setStatus("🟢 Select token");
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to scan tokens");
    }
  };

  const burn = async () => {
    if (!selected.length) return setStatus("Select token(s) to burn.");
    try {
      setStatus("🔥 Starting process...");

      const provider = new ethers.BrowserProvider((sdk as any).wallet.ethProvider as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT, ABI, signer);
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row || row.rawBalance === 0n) continue;

       const isApproved = approvedTokens.includes(tokenAddress);
if (!isApproved) {
  try {
    setStatus(`🧾 Approving ${row.symbol}...`);

    // 🔥 Nyalakan overlay
    setShowWalletOverlay(true);
    setOverlayMessage(`Waiting wallet popup to approve ${row.symbol}...`);
    setOverlayLoading(true);

    const tokenContract = new ethers.Contract(row.address, ERC20_ABI, signer);

    // 🚀 popup wallet muncul disini
    const tx = await tokenContract.approve(CONTRACT, row.rawBalance, {
      gasLimit: 200_000n
    });

    // ubah pesan setelah popup diklik user
    setOverlayMessage(`Confirming ${row.symbol} approval...`);

    // tunggu blockchain
    await rpc.waitForTransaction(tx.hash);

    // selesai approve → tampilkan sukses
    setOverlayLoading(false);
    setOverlaySuccess(`${row.symbol} Approved!`);
    setTimeout(() => setOverlaySuccess(""), 1200);

    setApprovedTokens(prev => [...prev, tokenAddress]);

  } catch (err: any) {
    console.error(err);

    // ❗ kalau user cancel, matikan overlay
    setOverlayLoading(false);
    setShowWalletOverlay(false);
    setOverlayMessage("");

    if (err?.code === 4001) {
      setStatus("User canceled approve");
    } else {
      setStatus("Approve failed");
    }

    continue; // lanjut token berikut / stop sesuai logic
  }

  // 🔥 Matikan overlay setelah approve selesai
  setShowWalletOverlay(false);
  setOverlayMessage("");

  continue;
}

        // === STEP 2: Fee ===
let feeWei = 0n;
try {
  const [feeRequired] = await contract.quoteErc20Fee(row.address, row.rawBalance);

  // Pastikan fee selalu memenuhi syarat kontrak
  feeWei = feeRequired;

} catch (err) {
  console.error("Fee error, using fallback:", err);

  // fallback aman (tidak boleh nol)
  feeWei = ethers.parseUnits("0.00005", "ether");
}


// === STEP 3: Burn ===
try {
  setStatus(`🔥 Burning ${row.symbol}...`);

  setShowWalletOverlay(true);
  setOverlayMessage(`Waiting wallet popup to burn ${row.symbol}...`);
  setOverlayLoading(true);

  const iface = new ethers.Interface(ABI);
  const data = iface.encodeFunctionData("burnToken", [
    row.address,
    row.rawBalance,
    JSON.stringify({ safe: true }),
  ]);

  // Kirim transaksi + fee yang benar
  const tx = await signer.sendTransaction({
    to: CONTRACT,
    data,
    value: feeWei,       // FEE SELALU BENAR → tidak FEE_LOW
    gasLimit: 350_000n,
  });

  setOverlayMessage(`Waiting burn confirmation for ${row.symbol}...`);
  await rpc.waitForTransaction(tx.hash);

  setOverlayLoading(false);
  setOverlaySuccess(`${row.symbol} Burned!`);
  setTimeout(() => setOverlaySuccess(""), 1200);

  setStatus(`✅ Burned ${row.symbol} successfully!`);

} catch (err: any) {
  console.error(err);

  setOverlayLoading(false);
  setOverlayMessage("");
  setShowWalletOverlay(false);

  if (err?.code === 4001) {
    setStatus("User canceled burn");
  } else {
    setStatus("Burn failed");
  }

  continue;
}

setShowWalletOverlay(false);
setOverlayMessage("");


      }

      loadTokens();
    } catch (e: any) {
      console.error(e);
      setShowWalletOverlay(false); // pastikan overlay mati kalau error
      setStatus("❌ Failed, try again.");
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

      {/* 🔥 overlay transparan anti putih */}
      {showWalletOverlay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[9999] pointer-events-none"></div>
      )}

      <h1 className="text-3xl font-bold mb-2 text-center text-[#00FF3C]">PUBS BURN</h1>
      <p className="text-sm text-gray-400 mb-4 text-center">
        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connecting wallet..."}
      </p>

      <div className="w-full max-w-sm flex flex-col bg-[#151515] rounded-xl border border-[#00FF3C30] overflow-hidden">

        <div className="flex justify-between p-2 border-b border-[#00FF3C30] bg-[#111] sticky top-0 z-10">
          <div className="text-xs text-[#FF4A4A]">ALWAYS VERIFY BEFORE BURN 🚨</div>
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
            className={`w-full py-3 rounded-xl font-bold
              ${
                selected.every((s) => approvedTokens.includes(s))
                  ? "bg-[#00FF3C] hover:bg-[#32FF67] text-black"
                  : "bg-[#FFB800] hover:bg-[#FFCC33] text-black"
              }
            `}
          >
            {selected.length === 0
              ? "Select token first"
              : selected.every((s) => approvedTokens.includes(s))
                ? `Burn Now (${selected.length})`
                : `Approve Selected (${selected.length})`}
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
{/* LOADING OVERLAY */}
{overlayLoading && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[999999]">
    <div className="flex flex-col items-center">
      <div className="h-12 w-12 border-4 border-gray-300 border-t-[#00FF3C] rounded-full animate-spin"></div>
      <p className="mt-4 text-white text-sm">{overlayMessage}</p>
    </div>
  </div>
)}

{/* SUCCESS OVERLAY */}
{overlaySuccess && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[999999]">
    <div className="px-6 py-4 bg-[#00FF3C] text-black rounded-2xl text-lg font-semibold shadow-xl">
      {overlaySuccess}
    </div>
  </div>
)}
      <p className="text-center text-sm text-gray-400 mt-4">{status}</p>
    </div>
  );
}
