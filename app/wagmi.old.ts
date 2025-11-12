"use client";

import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    farcasterMiniApp() // <— auto connect ke wallet Farcaster
  ],
  transports: {
    [base.id]: http(),
  },
});
