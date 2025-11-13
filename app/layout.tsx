import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const frame = {
    version: "1",
    imageUrl: "https://pubs-burn.vercel.app/image.png",
    button: {
      title: "Open PUBS BURN",
      action: {
        type: "launch_app",
        name: "PUBS BURN",
        url: "https://pubs-burn.vercel.app",
        splashImageUrl: "https://pubs-burn.vercel.app/splash.png",
        splashBackgroundColor: "#0A0A0A",
      },
    },
  };

  return {
    title: "PUBS BURN",
    other: {
      "fc:miniapp": JSON.stringify(frame),
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
