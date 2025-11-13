import type { Metadata } from "next";
import { redirect } from "next/navigation";

// META WAJIB ADA DI SINI
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
    }),
  },
};

// HALAMAN INI HARUS RETURN redirect server-side
export default function Home() {
  redirect("/miniapp");
}
