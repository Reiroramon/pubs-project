/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,

  images: {
    domains: ["images.unsplash.com", "cdn.farcaster.xyz", "ipfs.io"],
  },

  // Hilangkan bagian "env" di sini
  // karena kita akan pakai .env.local untuk menyimpan key rahasia

  turbopack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;

