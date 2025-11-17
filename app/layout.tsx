// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PUBS BURN",
  description: "Easy ways to make your wallet cleans — Burn scam tokens instantly!",
  openGraph: {
    title: "PUBS BURN",
    description:
      "Easy ways to make your wallet cleans — Burn scam tokens instantly!",
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
      <head>
        {/* 🔥 Tambahkan manual SUPAYA property= */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:miniapp:domain" content="pubs-burn.vercel.app" />

        {/* miniapp config */}
        <meta property="fc:miniapp" content={JSON.stringify({
          version: "1",
          imageUrl: "https://pubs-burn.vercel.app/image.png",
          button: {
            title: "BURN IT !",
            action: {
              type: "launch_frame",
              name: "PUBS BURN",
              url: "https://pubs-burn.vercel.app",
              splashImageUrl: "https://pubs-burn.vercel.app/splash.png",
              splashBackgroundColor: "#0A0A0A",
            },
          },
        })} />
      </head>

      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
