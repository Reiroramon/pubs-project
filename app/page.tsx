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
          url: "https://pubs-burn.vercel.app/miniapp"
        }
      }
    })
  }
};

export default function Home() {
  return (
    <main
      style={{
        color: "white",
        padding: 32,
        textAlign: "center",
        background: "#000",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>PUBS BURN</h1>
      <p>Burn scam tokens instantly.</p>

      <a
        href="/miniapp"
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 20px",
          background: "#00FF3C",
          color: "#000",
          borderRadius: 12,
          fontWeight: "bold",
        }}
      >
        Open Miniapp
      </a>
    </main>
  );
}
