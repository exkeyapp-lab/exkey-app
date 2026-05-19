import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExKey · 關鍵人脈媒合平台",
  description: "沒關係 找 關係 的關鍵人脈網 — 業務 × 廠商 智慧媒合",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="font-sans bg-purple-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
