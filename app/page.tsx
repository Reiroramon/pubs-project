"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Home() {
  useEffect(() => {
    // untuk menghilangkan splash screen kalau dibuka di miniapps
    sdk.actions.ready();
  }, []);

  return (
    <div
      style={{
        color: "white",
        padding: "32px",
        textAlign: "center",
        background: "#000",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>PUBS BURN</h1>
      <p>Burn scam tokens in one tap.</p>

      <a
        href="/miniapp"
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 20px",
          background: "#00FF3C",
          color: "#000",
          borderRadius: 12,
          fontWeight: "bold",
        }}
      >
        Open Miniapp
      </a>
    </div>
  );
}
