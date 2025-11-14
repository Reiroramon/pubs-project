"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Home() {
  useEffect(() => {
    // beri tahu Farcaster bahwa UI kamu sudah siap tampil
    sdk.actions.ready();
  }, []);

  return (
    <main style={{ padding: 20 }}>
      <h1>PUBS BURN Mini App</h1>
      <p>Mini App ready.</p>
    </main>
  );
}
