/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp & @imgly/background-removal-node (via onnxruntime-node) punya
  // binary native (.node) -- tanpa ini, webpack mencoba membundelnya sebagai
  // kode JS biasa dan build gagal. Ini membuat Next.js `require()` paket-paket
  // ini langsung dari node_modules saat runtime, bukan ikut di-bundle.
  experimental: {
    serverComponentsExternalPackages: ["sharp", "@imgly/background-removal-node", "onnxruntime-node"],
  },

  // Security Headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=*, microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
