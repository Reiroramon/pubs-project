import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#1e1e1e", // abu-abu gelap
          color: "#f5f5f5", // teks abu terang
          minHeight: "100vh",
          margin: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
export const metadata = {
  title: "Pubs Burn",
  description: "Protect User Burn Scam",
};
