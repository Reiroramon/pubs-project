import type { Metadata } from "next";

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
          url: "https://pubs-burn.vercel.app/miniapp",
        },
      },
    }),
  },
};

export default function Home() {
  return (
    <main style={{ padding: 32, color: "white" }}>
      PUBS BURN — Tap the link below to open Mini App <br /><br />
      <a
        href="/miniapp"
        style={{ color: "#00FF3C", fontWeight: "bold" }}
      >
        👉 Open Miniapp
      </a>
    </main>
  );
}
