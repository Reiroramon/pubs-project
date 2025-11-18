// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PUBS BURN",
  description: "Easy ways to make your wallet clean — Burn scam tokens instantly!",

  // ⭐ FARCASTER MINIAPP META TAG (WAJIB UNTUK EMBED)
  other: {
    "fc:frame": "vNext",
    "fc:app": "mini",
    "fc:miniapp": "true",
    "fc:miniapp:manifest": "https://pubs-burn.vercel.app/.well-known/farcaster.json",
  },

  // ⭐ SHARE CARD (OG TAGS)
  openGraph: {
    title: "PUBS BURN",
    description: "Easy ways to make your wallet clean — Burn scam tokens instantly!",
    url: "https://pubs-burn.vercel.app",
    images: [
      {
        url: "https://pubs-burn.vercel.app/hiro.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
