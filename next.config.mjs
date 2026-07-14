/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static, client-side site — no server runtime. Deployable to any static host.
  output: 'export',
  reactStrictMode: true,
  // Static export cannot use the Next Image Optimization server.
  images: { unoptimized: true },
  // Emit /json/ instead of /json.html so links work on static hosts.
  trailingSlash: true,
};

export default nextConfig;
