import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

export async function POST(req: NextRequest) {
  try {
    const { fids, title, body, targetUrl } = await req.json();

    const config = new Configuration({
      apiKey: process.env.NEYNAR_API_KEY!,
    });

    const client = new NeynarAPIClient(config);

    const response = await client.publishFrameNotifications({
      targetFids: fids,
      filters: {},
      notification: {
        title,
        body,
        target_url: targetUrl,
      },
    });

    return NextResponse.json({ ok: true, response });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
