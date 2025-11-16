// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const miniapp = {
  version: "1",
  imageUrl: "https://pubs-burn.vercel.app/image.png",
  button: {
    title: "Open App",
    action: {
      type: "launch_frame",
      name: "PUBS BURN",
      url: "https://pubs-burn.vercel.app",
      splashImageUrl: "https://pubs-burn.vercel.app/splash.png",
      splashBackgroundColor: "#0A0A0A",
    },
  },
};

export const metadata: Metadata = {
  title: "PUBS BURN",
  other: {
    "fc:miniapp": JSON.stringify(miniapp),
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
