"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "./wagmi";

import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "viem/chains";

const queryClient = new QueryClient();

// DETECT MINIAPP
function isMiniAppEnv() {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).farcaster || (window as any).fc);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const isMiniApp = isMiniAppEnv();

  // MINIAPP MODE → OnchainKit OFF
  if (isMiniApp) {
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  // NORMAL WEB MODE → OnchainKit ON
  return (
    <WagmiProvider config={wagmiConfig}>
      <OnchainKitProvider
        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY!}
        chain={base}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </OnchainKitProvider>
    </WagmiProvider>
  );
}
