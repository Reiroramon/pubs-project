export const generateMetadata = async () => {
  const frame = {
    version: "1",
    imageUrl: "https://pubs-burn.vercel.app/image.png", // harus 3:2
    button: {
      title: "Open PUBS BURN",
      action: {
        type: "launch_app",
        name: "PUBS BURN",
        url: "https://pubs-burn.vercel.app",
        splashImageUrl: "https://pubs-burn.vercel.app/splash.png",
        splashBackgroundColor: "#0A0A0A"
      }
    }
  };

  return {
    other: {
      "fc:miniapp": JSON.stringify(frame)
    }
  };
};
