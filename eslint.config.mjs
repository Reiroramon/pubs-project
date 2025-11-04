import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig({
  extends: [
    "next/core-web-vitals",
  ],
  ignorePatterns: [
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ],
  rules: {
    // Tambahkan aturan tambahan jika mau
    "@next/next/no-img-element": "off", // contoh: izinkan <img> biasa
  },
});

