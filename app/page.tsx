"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Home() {
  // WAJIB: panggil ready() di root
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // redirect manual, TAPI pakai client navigation
  useEffect(() => {
    window.location.href = "/miniapp";
  }, []);

  return <div style={{ color: "white", padding: 32 }}>Loading...</div>;
}
