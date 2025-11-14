import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const FARCASTER_WEBHOOK_SECRET = process.env.FARCASTER_WEBHOOK_SECRET!;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? null;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-farcaster-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // --- VALIDASI HMAC SHA256 ---
    const hmac = crypto
      .createHmac("sha256", FARCASTER_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(signature)
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);

    // --- LOG UTAMA ---
    console.log("Webhook Event Received :", body);

    // ============================================================
    // 1️⃣ EVENT: Burn Token Transaction (from sendTransaction)
    // ============================================================

    if (body.type === "wallet.transaction_submitted") {
      const tx = body.transaction;
      const fid = body.fid;

      const record = {
        event: "burn_tx",
        fid,
        txHash: tx.hash,
        chainId: tx.chainId,
        to: tx.to,
        data: tx.data,
        timestamp: new Date().toISOString(),
      };

      console.log("🔥 Burn TX Submitted:", record);

      // Optional: Extract token address & amount from ABI (if needed)
      // but for now just log raw TX data.

      // ---------------------------------------------
      // (optional) Kirim ke Discord
      // ---------------------------------------------
      if (DISCORD_WEBHOOK) {
        await fetch(DISCORD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🔥 **PUBS BURN - TX Submitted**
**FID:** ${fid}
**Hash:** ${tx.hash}
**Chain:** ${tx.chainId}
`,
          }),
        });
      }

      return NextResponse.json({ ok: true, message: "Burn TX logged" });
    }

    // ============================================================
    // 2️⃣ EVENT: Transaction confirmed
    // ============================================================

    if (body.type === "wallet.transaction_confirmed") {
      const tx = body.transaction;
      const fid = body.fid;

      console.log("🎉 Burn TX Confirmed:", tx.hash);

      if (DISCORD_WEBHOOK) {
        await fetch(DISCORD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🎉 **Burn Confirmed!**
**FID:** ${fid}
**TX:** https://basescan.org/tx/${tx.hash}`,
          }),
        });
      }

      return NextResponse.json({ ok: true, message: "Burn TX confirmed" });
    }

    // Default response
    return NextResponse.json({ ok: true, note: "Event ignored" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
