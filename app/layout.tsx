// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PUBS BURN",
  description: "Easy ways to make your wallet clean — burn scam tokens instantly!",

  // ⭐ COMBINED MINIAPP + FRAME EMBED
  other: {
    // === MINIAPP DISCOVERY (AGAR MUNCUL DI SEARCH) ===
    "fc:app": "mini",
    "fc:miniapp": "true",
    "fc:miniapp:manifest": "https://pubs-burn.vercel.app/.well-known/farcaster.json",

    // === FRAME EMBED (AGAR MUNCUL SEBAGAI CARD SAAT DI-SHARE) ===
    "fc:frame": "vNext",
    "fc:frame:image": "https://pubs-burn.vercel.app/hero.png",
    "fc:frame:button:1": "Open Miniapp",
    "fc:frame:button:1:action": "launch_frame",
    "fc:frame:button:1:target": "https://pubs-burn.vercel.app/miniapp",
  },

  // ⭐ OG SHARE (CARD GAMBAR 1200x630)
  openGraph: {
    title: "PUBS BURN",
    description: "Easy ways to make your wallet clean — burn scam tokens instantly!",
    url: "https://pubs-burn.vercel.app",
    images: [
      {
        url: "https://pubs-burn.vercel.app/hero.png",
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
