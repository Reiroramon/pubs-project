import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PUBS BURN",
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://pubs-burn.vercel.app/image.png",
      button: {
        title: "Open PUBS BURN",
        action: {
          type: "launch_app",
          name: "PUBS BURN",
          url: "https://pubs-burn.vercel.app/miniapp"
        }
      }
    })
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
