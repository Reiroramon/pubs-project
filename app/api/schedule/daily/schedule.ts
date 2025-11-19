import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

export const runtime = "edge";

// Cron: setiap hari jam 15:00 UTC (10 AM ET)
export const schedule = "0 15 * * *";

export default async function () {
  try {
    const client = new NeynarAPIClient(
      new Configuration({ apiKey: process.env.NEYNAR_API_KEY! })
    );

    await client.publishFrameNotifications({
      targetFids: [],
      filters: {},
      notification: {
        title: "⛔ Something suspicious is hiding in your wallet!",
        body: "A few tokens look unsafe. Tap to clean up before it's too late.",
        target_url: "https://pubs-burn.vercel.app",
      },
    });

    return new Response("CRON RUN OK");
  } catch (e) {
    console.error(e);
    return new Response("CRON ERROR", { status: 500 });
  }
}
