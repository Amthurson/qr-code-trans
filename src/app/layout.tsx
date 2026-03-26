import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "离线问卷二维码传输系统",
  description: "患者填写问卷 → 编码压缩 → 生成二维码 → 医院扫码 → 解码还原",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
