// app/miniapp/layout.tsx
import { Providers } from "../providers";   // ← FIX
import "../globals.css";

export default function MiniappLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
