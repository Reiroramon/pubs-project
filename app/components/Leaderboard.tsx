"use client";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

function getRank(score: number) {
  if (score >= 15) return "🟢 PUBS Elite";
  if (score >= 5) return "🔥 Guardian";
  return "🔹 Rookie Burner";
}

export default function Leaderboard() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then(setRows);
  }, []);

  const share = async () => {
    const text = "I just cleaned my wallet by burning a scam token 🔥 #SafetyPoints";
    await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`);
  };

  return (
    <div className="mt-6 bg-[#262626] p-5 rounded-xl border border-[#333]">
      <h2 className="text-lg font-semibold text-[#7ddc9c] mb-4">🏆 Safety Points Leaderboard</h2>

      {rows.map((row, i) => (
        <div key={i} className="flex justify-between py-2 border-b border-[#333]">
          <div>
            {i + 1}. {row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}
            <div className="text-xs text-gray-400">{getRank(row.score)}</div>
          </div>
          <div className="text-[#7ddc9c] font-semibold">{row.score} pts</div>
        </div>
      ))}

      <button
        className="mt-4 w-full py-3 rounded-lg bg-[#7ddc9c] text-black font-bold hover:opacity-90"
        onClick={share}
      >
        📢 Share My Achievement
      </button>
    </div>
  );
}
