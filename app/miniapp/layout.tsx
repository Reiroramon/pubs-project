"use client";

import Providers from "../providers";

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
