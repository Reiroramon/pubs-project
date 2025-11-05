import "./globals.css";
import { Poppins } from "next/font/google";
import type { ReactNode } from "react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"], // sesuaikan sesuai kebutuhan
});

export const metadata = {
  title: "PUBS Burning Token",
  description: "Burn your tokens with style 🔥",
};

// Tambahkan tipe untuk props
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-black text-white`}>
        {children}
      </body>
    </html>
  );
}
