import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "PUBS Burn",
  description: "Burn scam tokens safely.",
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
