"use client";

import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";

type AddFrameResult =
  | {
      added: true;
      notificationDetails?: {
        url: string;
        token: string;
      };
    }
  | {
      added: false;
      reason: "invalid_domain_manifest" | "rejected_by_user";
    };

export default function AddMiniAppButton() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    sdk.actions.ready();
    setIsLoaded(true);
  }, []);

  const handleAddMiniApp = async () => {
    if (!isLoaded) return;

    const result = (await sdk.actions.addFrame()) as AddFrameResult;

    console.log("Result:", result);

    if (result.added) {
      console.log("Mini app added!");
      console.log("Notif token:", result.notificationDetails?.token);
    } else {
      console.log("Mini app NOT added:", result.reason);
    }
  };

  return (
    <button
      onClick={handleAddMiniApp}
      className="px-4 py-2 bg-purple-600 text-white rounded"
    >
      Add Mini App
    </button>
  );
}
