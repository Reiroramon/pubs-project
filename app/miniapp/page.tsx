"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";

export default function MiniAppLanding() {
  useEffect(() => {
    // Beri tahu Warpcast bahwa UI miniapp sudah siap ditampilkan
    sdk.actions.ready();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-4xl font-bold mb-4">PUBS BURN</h1>
      <p className="text-gray-400 mb-6 text-center">
        Safe Token Burner Miniapp • Powered by Privy
      </p>

      <Link
        href="/"
        className="px-6 py-3 bg-[#00ff00] text-black rounded-lg font-bold shadow-[0_0_12px_#00ff00] hover:shadow-[0_0_18px_#00ff00] transition-all"
      >
        Open App
      </Link>
    </div>
  );
}
