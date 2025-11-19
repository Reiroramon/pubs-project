// app/api/cron/daily/route.ts
import { NextResponse } from "next/server";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

export const runtime = "edge";

export async function GET() {
  try {
    const client = new NeynarAPIClient(
      new Configuration({ apiKey: process.env.NEYNAR_API_KEY! })
    );

    const response = await client.publishFrameNotifications({
      targetFids: [], // kirim ke semua user
      filters: {},
      notification: {
        title: "⛔ Something suspicious is hiding in your wallet!",
        body: "You should check this. A few tokens look unsafe and could cause trouble if ignored. Tap now before it’s too late.",
        target_url: "https://pubs-burn.vercel.app",
      },
    });

    return NextResponse.json({ ok: true, response });
  } catch (err) {
    console.error("Cron daily error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
