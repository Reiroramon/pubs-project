import "./globals.css";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata = {
  title: "Pubs Burn",
  description: "Burn Your Dump",
  icons: {
    icon: "/favicon.png", // <-- tambahkan ini
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}
