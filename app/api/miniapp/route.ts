import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // ⚠️ Gunakan ANY supaya tidak ada masalah TypeScript
    const event: any = await parseWebhookEvent(json, verifyAppKeyWithNeynar);

    console.log("Parsed Event:", event);

    switch (event.event) {
      case "miniapp_added":
        if (event.notificationDetails) {
          console.log("SAVE token:", event.notificationDetails.token);
        }
        break;

      case "notifications_enabled":
        console.log("Notifications enabled:", event.notificationDetails?.token);
        break;

      case "notifications_disabled":
        console.log("Notifications disabled");
        break;

      case "miniapp_removed":
        console.log("Miniapp removed");
        break;

      default:
        console.log("Unknown event:", event);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
