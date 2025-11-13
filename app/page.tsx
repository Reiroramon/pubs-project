"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import type { Metadata } from "next";

// --- INI WAJIB UNTUK EMBED ---
export const metadata: Metadata = {
  title: "PUBS BURN",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://pubs-burn.vercel.app/image.png",
      button: {
        title: "Open PUBS BURN",
        action: {
          type: "launch_app",
          name: "PUBS BURN",
          url: "https://pubs-burn.vercel.app/miniapp",
        },
      },
    }),
  },
};

export default function Home() {
  // hilangkan splash
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // redirect client-side
  useEffect(() => {
    window.location.href = "/miniapp";
  }, []);

  return <div style={{ color: "white", padding: 32 }}>Loading...</div>;
}
