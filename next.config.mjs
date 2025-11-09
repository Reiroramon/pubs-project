import os from "os";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // ← ini yang penting

  // Allowed origins (punya kamu, tetap dipertahankan)
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: (() => {
      const interfaces = os.networkInterfaces();
      const ips = [];

      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === "IPv4" && !iface.internal) {
            ips.push(iface.address);
          }
        }
      }

      return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        ...ips.map((ip) => `http://${ip}:3000`),
      ];
    })(),
  }),
};

export default nextConfig;

