// next.config.mjs
import os from 'os';

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  return ips;
}

const localIPs = getLocalIPs();

const nextConfig = {
  reactStrictMode: true,
  // Hanya berlaku di development
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...localIPs.map(ip => `http://${ip}:3000`),
    ],
  }),
};

export default nextConfig;
