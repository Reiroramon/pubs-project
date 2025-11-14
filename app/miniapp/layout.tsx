// app/miniapp/layout.tsx
import Providers from "../providers";
import "./../globals.css";

export default function MiniappLayout({ children }: { children: React.ReactNode }) {
  // Only wrap the miniapp route with Wagmi/Query providers
  return <Providers>{children}</Providers>;
}
