import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 禁用开发指示器（减少 WebSocket 连接）
  devIndicators: false,
  
  // 允许局域网访问（开发模式）
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.31.99:3000',
    '192.168.31.99',
  ],
  
  // 禁用 React Fast Refresh（解决 WebSocket 问题）
  reactStrictMode: true,
  
  // 生产环境优化
  poweredByHeader: false,
};

export default nextConfig;
