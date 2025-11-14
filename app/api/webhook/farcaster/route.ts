import { NextResponse } from "next/server";

export function GET() {
  const json = {
    accountAssociation: {
      header: "eyJmaWQiOjM5MDQwMywidHlwZSI6ImF1dGgiLCJrZXkiOiIweDE5YzBjQmVBRTg4MTQ3NmM4MzhkYTNlMjFhREIzRmM0NzU1MjVBRTUifQ",
      payload: "eyJkb21haW4iOiJwdWJzLWJ1cm4udmVyY2VsLmFwcCJ9",
      signature: "aSzqOkZH8eKxb2wW80NHVk311ugLNlQxFyrtlR7BppU1QeEMtceysbKYIKw8BtP8dSEWItFZUBN7bNgeK35/6xs="
    },
    frame: {
      version: "1",
      name: "PUBS BURN",
      description: "Burn scam tokens safely inside Farcaster.",
      iconUrl: "https://pubs-burn.vercel.app/icon.png",
      homeUrl: "https://pubs-burn.vercel.app"
    },
    requiredCapabilities: [
      "actions.openUrl",
      "actions.signIn",
      "wallet.sendTransaction",
      "wallet.getEthereumProvider"
    ]
  };

  return new NextResponse(JSON.stringify(json), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "max-age=0, must-revalidate"
    }
  });
}
