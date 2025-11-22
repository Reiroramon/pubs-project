"use client";
import { Wallet } from "@coinbase/onchainkit/wallet";

export default function Page() {
  return (
    <div style={{ padding: 40 }}>
      <Wallet />
    </div>
  );
}
