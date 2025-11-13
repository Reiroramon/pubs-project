"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Home() {
  // Hilangkan splash
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Redirect client-side
  useEffect(() => {
    window.location.href = "/miniapp";
  }, []);

  return <div style={{ color: "white", padding: 32 }}>Loading...</div>;
}
