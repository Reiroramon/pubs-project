"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { FiAlertTriangle } from "react-icons/fi";
import { Wallet } from "@coinbase/onchainkit/wallet";
import { FiSearch, FiBell } from "react-icons/fi";

/* ===========================
    CONFIG
=========================== */
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const MINIAPP_URL = "https://farcaster.xyz/miniapps/mz8cOJsCFzrX";

const ABI = [
  "function quoteErc20Fee(address token, uint256 amount) view returns (uint256, uint8)",
  "function burnToken(address token, uint256 amount, string scanSummary) payable",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

/* ===========================
    FARCASTER USER (PFP)
=========================== */
function useFarcasterUser() {
  const [pfp, setPfp] = useState<string | null>(null);

  useEffect(() => {
    const fallback = "https://i.imgur.com/5cY8XGQ.png";
    try {
      const ctx = (sdk as any)?.context;
      const url = ctx?.user?.pfpUrl;
      setPfp(url && url.length > 2 ? url : fallback);
    } catch {
      setPfp(null);
    }
  }, []);

  return pfp;
}

/* ===========================
    FARCASTER WALLET POPUP
=========================== */
async function requestFarcasterWallet() {
  const provider = (sdk as any)?.wallet?.ethProvider;

  if (!provider) {
    console.warn("Farcaster provider not available");
    return null;
  }

  // THIS LINE triggers Farcaster Wallet popup
  await provider.request({
    method: "eth_requestAccounts",
  });

  return provider;
}
/* ===========================
    TOKEN CARD
=========================== */
interface TokenCardProps {
  token: any;
  active: boolean;
  onSelect: () => void;
  userPfp: string | null;
}

function TokenCard({ token, active, onSelect, userPfp }: TokenCardProps) {
  return (
    <div className="relative">
      {/* Floating user avatar */}
      {userPfp && (
        <img
          src={userPfp}
          className="w-7 h-7 rounded-full absolute -top-3 -left-3 border border-black shadow-md z-20"
        />
      )}

      <button
        onClick={onSelect}
        className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all relative
          ${
            active
              ? "border-[#0052FF] bg-[#121212]"
              : "border-[#222] bg-[#151515] hover:bg-[#1b1b1b]"
          }`}
      >
        {/* Token Logo */}
        <div className="relative">
          <img
            src={token.logoUrl}
            className="w-10 h-10 rounded-xl object-cover shadow"
          />

          {/* Scam Badge */}
          {token.isScam && (
            <span className="absolute -top-1 -right-1 text-[11px] px-1.5 py-0.5 bg-red-600/80 text-white rounded-md">
              Scam
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="text-white font-semibold text-[15px] truncate">
            {token.name}
          </div>

          <div className="text-gray-400 text-[13px] truncate">
            {token.symbol} • {Number(token.balance).toFixed(4)}
          </div>
        </div>

        {/* Price */}
        <div
          className={`text-sm ${
            token.isScam ? "text-red-400" : "text-green-400"
          }`}
        >
          {token.price ? `$${token.price}` : "0.00"}
        </div>

        {/* Checkbox */}
        <div
          className={`w-5 h-5 rounded-md border flex items-center justify-center ml-3
            ${active ? "border-[#0052FF] bg-[#0052FF]" : "border-gray-500"}`}
        >
          {active && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
        </div>
      </button>
    </div>
  );
}

/* ===========================
    WALLET CONNECT MODAL
=========================== */
function ConnectWalletModal({ open, onClose, onConnectFarcaster, onConnectBase, status }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999]">
      <div className="bg-[#181818] rounded-xl p-6 w-80 flex flex-col items-center shadow-lg">
        <h2 className="text-lg font-bold mb-4">Connect Wallet</h2>
        <button
          onClick={onConnectFarcaster}
          className="w-full py-2 mb-3 rounded-lg bg-[#0052FF] hover:bg-[#1A66FF] text-white font-semibold"
        >
          Connect Farcaster Wallet
        </button>
        <button
          onClick={onConnectBase}
          className="w-full py-2 rounded-lg bg-[#222] hover:bg-[#333] text-gray-200 font-semibold"
        >
          Connect Base App Wallet
        </button>
        <button
          onClick={onClose}
          className="mt-4 text-xs text-gray-400 hover:underline"
        >
          Cancel
        </button>
        {status && <div className="mt-3 text-sm text-gray-300">{status}</div>}
      </div>
    </div>
  );
}

/* ===========================
    NAVBAR (MODIFIED)
=========================== */
function Navbar({ onOpenConnect, isFarcasterConnected, isBaseConnected }: any) {
  return (
    <div className="w-full max-w-md flex items-center justify-between mb-6 px-1">
      <h1 className="text-xl font-bold tracking-wide">PUBS BURN</h1>
      <div className="flex items-center gap-4">
        <FiBell size={20} className="text-gray-300 cursor-pointer" />
        <button
          onClick={onOpenConnect}
          className="px-3 py-1 rounded-lg bg-[#0052FF] text-white text-xs font-semibold"
        >
          {isFarcasterConnected || isBaseConnected ? "Wallet Connected" : "Connect Wallet"}
        </button>
      </div>
    </div>
  );
}

/* ===========================
    SEARCH BAR
=========================== */
function SearchBar({ value, onChange }: any) {
  return (
    <div className="w-full max-w-md mb-4">
      <div className="flex items-center bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2">
        <FiSearch size={16} className="text-gray-400 mr-2" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search tokens..."
          className="w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-500"
        />
      </div>
    </div>
  );
}

/* ===========================
    BATCH BURN BAR
=========================== */
function BatchBurnBar({ count, onBurn }: any) {
  if (count === 0) return null;

  return (
    <div className="w-full max-w-md sticky top-0 z-30 mb-4">
      <div className="bg-[#0d0d0d]/90 backdrop-blur-md border border-[#222] rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
        <span className="text-gray-200 text-sm">{count} token selected</span>

        <button
          onClick={onBurn}
          className="px-4 py-2 rounded-lg bg-[#0052FF] hover:bg-[#1A66FF] text-white text-sm font-semibold"
        >
          Burn Selected
        </button>
      </div>
    </div>
  );
}
/* ===========================
    APPROVE + BURN LOGIC
=========================== */

// FARCASTER WALLET SIGNER (POPUP)
async function getFarcasterSigner() {
  const eth = (sdk as any)?.wallet?.ethProvider;

  if (!eth) {
    alert("Farcaster wallet not available. Please open in Farcaster Miniapp.");
    return null;
  }

  // Trigger wallet popup in Farcaster Miniapp
  await eth.request({
    method: "eth_requestAccounts",
  });

  const provider = new ethers.BrowserProvider(eth);
  return provider.getSigner();
}

function useBurnActions(tokens: any[], selected: string[], setSelected: any, setStatus: any) {
  const [approvedTokens, setApprovedTokens] = useState<string[]>([]);
  const [lastBurnTx, setLastBurnTx] = useState<string | null>(null);

  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [overlaySuccess, setOverlaySuccess] = useState("");

  const burn = async () => {
    if (selected.length === 0) return;

    setStatus("🔥 Starting burn...");

    try {
      // Always use Farcaster signer (popup triggered)
      const signer = await getFarcasterSigner();
      if (!signer) {
        setStatus("Could not connect Farcaster wallet");
        return;
      }

      const contract = new ethers.Contract(CONTRACT, ABI, signer);
      const rpc = new ethers.JsonRpcProvider("https://mainnet.base.org");

      /* ==========================
          APPROVAL PHASE
      =========================== */

      const needApproval = selected.filter((t) => !approvedTokens.includes(t));

      for (const tokenAddress of needApproval) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        try {
          setOverlayLoading(true);
          setOverlayMessage(`Approving ${row.symbol} via Farcaster...`);

          const erc20 = new ethers.Contract(row.address, ERC20_ABI, signer);
          const tx = await erc20.approve(CONTRACT, row.rawBalance);

          await rpc.waitForTransaction(tx.hash);

          setApprovedTokens((prev) => [...prev, tokenAddress]);

          setOverlayLoading(false);
          setOverlaySuccess(`${row.symbol} Approved`);
          setTimeout(() => setOverlaySuccess(""), 1200);
        } catch {
          setOverlayLoading(false);
          setStatus("Approval failed");
          return;
        }
      }

      /* ==========================
          BURN PHASE
      =========================== */

      for (const tokenAddress of selected) {
        const row = tokens.find((t) => t.address === tokenAddress);
        if (!row) continue;

        try {
          setOverlayLoading(true);
          setOverlayMessage(`Burning ${row.symbol} via Farcaster...`);

          const contract = new ethers.Contract(CONTRACT, ABI, signer);
          const [feeRequired] = await contract.quoteErc20Fee(
            row.address,
            row.rawBalance
          );

          const iface = new ethers.Interface(ABI);
          const data = iface.encodeFunctionData("burnToken", [
            row.address,
            row.rawBalance,
            JSON.stringify({ safe: true }),
          ]);

          const tx = await signer.sendTransaction({
            to: CONTRACT,
            data,
            value: feeRequired,
          });

          await rpc.waitForTransaction(tx.hash);

          setOverlayLoading(false);
          setOverlaySuccess(`${row.symbol} Burned`);
          setTimeout(() => setOverlaySuccess(""), 1200);

          setLastBurnTx(tx.hash);
        } catch {
          setOverlayLoading(false);
          setStatus("Burn failed");
          return;
        }
      }

      /* Done */
      setStatus("🎉 Burn complete!");
      setSelected([]);
    } catch (err) {
      console.error(err);
      setOverlayLoading(false);
      setStatus("Unexpected error");
    }
  };

  return {
    burn,
    approvedTokens,
    lastBurnTx,
    overlayLoading,
    overlayMessage,
    overlaySuccess,
  };
}
/* ===========================
    OVERLAY COMPONENTS
=========================== */

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-[999]">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 border-[3px] border-gray-500 border-t-[#0052FF] rounded-full animate-spin" />
        <p className="mt-4 text-gray-300 text-sm">{message}</p>
      </div>
    </div>
  );
}

function SuccessToast({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[999]">
      <div className="px-6 py-3 bg-[#0052FF] rounded-xl shadow-xl text-white text-lg font-semibold">
        {text}
      </div>
    </div>
  );
}

/* ===========================
    MAIN PAGE RENDER
=========================== */

export default function Page() {
  const { address, isConnected } = useAccount();

  const pfp = useFarcasterUser();
  const [tokens, setTokens] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("Initializing...");

  // Modal state
  const [showConnect, setShowConnect] = useState(false);
  const [connectStatus, setConnectStatus] = useState("");
  const [isFarcasterConnected, setIsFarcasterConnected] = useState(false);
  const [isBaseConnected, setIsBaseConnected] = useState(false);

  /* Burn actions hook */
  const {
    burn,
    approvedTokens,
    lastBurnTx,
    overlayLoading,
    overlayMessage,
    overlaySuccess,
  } = useBurnActions(tokens, selected, setSelected, setStatus);

  /* Miniapp ready */
  useEffect(() => {
    if (isConnected && address) sdk.actions.ready();
  }, [isConnected, address]);

  /* Token loading */
  useEffect(() => {
    if (!address || !isConnected) return;
    const t = setTimeout(loadTokens, 400);
    return () => clearTimeout(t);
  }, [address, isConnected]);

  /* Filtering */
  useEffect(() => {
    if (search.trim() === "") return setFiltered(tokens);
    const q = search.toLowerCase();
    setFiltered(
      tokens.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q)
      )
    );
  }, [search, tokens]);


  /* ===========================
      LOAD TOKENS FROM ALCHEMY
  ============================ */

  async function loadTokens() {
    const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
    if (!key) return setStatus("Alchemy key missing");

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

      const baseList = list
        .filter((t: any) => BigInt(t.tokenBalance) > 0n)
        .map((t: any) => ({
          address: t.contractAddress,
          rawBalance: BigInt(t.tokenBalance),
          name: "Loading...",
          symbol: "",
          decimals: 18,
          balance: "0",
          logoUrl: "/token.png",
          price: null,
          isScam: false,
        }));

      setTokens(baseList);
      setFiltered(baseList);
      setStatus("Select token to burn");

      /* ===========================
          Load metadata per token
      ============================ */
      baseList.forEach(async (token: any, i: number) => {
        try {
          const metaRes = await fetch(
            `https://base-mainnet.g.alchemy.com/v2/${key}`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                id: 2,
                jsonrpc: "2.0",
                method: "alchemy_getTokenMetadata",
                params: [token.address],
              }),
            }
          );

          const meta = await metaRes.json();
          const r = meta?.result;

          if (r) {
            token.decimals = r.decimals ?? 18;
            token.name = r.name || r.symbol || "Token";
            token.symbol = r.symbol || "";
            token.logoUrl = r.logo || "/token.png";
            token.balance = ethers.formatUnits(
              token.rawBalance,
              token.decimals
            );
          }

          /* Price (DexScreener) */
          try {
            const priceRes = await fetch(
              `https://api.dexscreener.com/latest/dex/tokens/${token.address}`
            );
            const priceJ = await priceRes.json();

            token.price = priceJ?.pairs?.[0]?.priceUsd ?? null;

            const img = priceJ?.pairs?.[0]?.info?.imageUrl;
            if (img) token.logoUrl = img;

            token.isScam = !token.price || Number(token.price) === 0;
          } catch {}
        } catch {}

        // update state
        setTokens((prev) => {
          const updated = [...prev];
          updated[i] = { ...token };
          return updated;
        });
      });
    } catch {
      setStatus("❌ Failed to scan tokens");
    }
  }

  // Connect Farcaster Wallet
  async function handleConnectFarcaster() {
    setConnectStatus("Connecting to Farcaster...");
    try {
      const provider = (sdk as any)?.wallet?.ethProvider;
      if (!provider) throw new Error("Farcaster provider not available");
      await provider.request({ method: "eth_requestAccounts" });
      setIsFarcasterConnected(true);
      setShowConnect(false);
      setConnectStatus("");
    } catch (e: any) {
      setConnectStatus("Failed to connect Farcaster wallet");
    }
  }

  // Connect Base App Wallet (OnchainKit)
  async function handleConnectBase() {
    setConnectStatus("Connecting to Base App...");
    try {
      // Wallet component from OnchainKit handles connection, just set state
      setIsBaseConnected(true);
      setShowConnect(false);
      setConnectStatus("");
    } catch (e: any) {
      setConnectStatus("Failed to connect Base App wallet");
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white px-5 py-6 flex flex-col items-center">

      {/* Navbar */}
      <Navbar
        onOpenConnect={() => setShowConnect(true)}
        isFarcasterConnected={isFarcasterConnected}
        isBaseConnected={isBaseConnected}
      />

      {/* Connect Wallet Modal */}
      <ConnectWalletModal
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onConnectFarcaster={handleConnectFarcaster}
        onConnectBase={handleConnectBase}
        status={connectStatus}
      />

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} />

      {/* Batch burn bar */}
      <BatchBurnBar count={selected.length} onBurn={burn} />

      {/* Tokens Grid */}
      <div
        className="
          w-full max-w-md grid gap-4
          grid-cols-1
          sm:grid-cols-2
          md:grid-cols-3
          mb-6
        "
      >
        {filtered.length === 0 ? (
          <div className="text-gray-500 text-sm col-span-full text-center">
            No tokens found.
          </div>
        ) : (
          filtered.map((t) => (
            <TokenCard
              key={t.address}
              token={t}
              userPfp={pfp}
              active={selected.includes(t.address)}
              onSelect={() =>
                setSelected(
                  selected.includes(t.address)
                    ? selected.filter((x) => x !== t.address)
                    : [...selected, t.address]
                )
              }
            />
          ))
        )}
      </div>

      {/* Refresh button */}
      <button
        onClick={loadTokens}
        className="w-full max-w-md py-3 rounded-xl bg-[#1A1A1A] border border-[#333] text-gray-200 hover:bg-[#222] font-semibold mb-4"
      >
        Scan / Refresh Tokens
      </button>

      {/* Share button */}
      {lastBurnTx && (
        <button
          onClick={() =>
            sdk.actions.openUrl(
              `https://warpcast.com/~/compose?text=${encodeURIComponent(
                `I burned scam tokens with PUBS BURN 🔥♻️\nTry it here:\n${MINIAPP_URL}`
              )}`
            )
          }
          className="w-full max-w-md py-3 rounded-xl bg-[#0052FF] hover:bg-[#1A66FF] font-semibold mb-4"
        >
          📣 Share on Warpcast
        </button>
      )}

      {/* Overlays */}
      {overlayLoading && <LoadingOverlay message={overlayMessage} />}
      {overlaySuccess && <SuccessToast text={overlaySuccess} />}

      {/* Status */}
      <p className="text-center text-sm text-gray-400 mt-4 mb-10">
        {status}
      </p>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 pb-10">
        PUBS BURN • Base Miniapp
        <br />
        <span className="text-gray-600">Always verify before burning tokens.</span>
      </div>
    </div>
  );
}
