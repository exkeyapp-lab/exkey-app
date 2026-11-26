import type { Metadata } from "next";
import "./globals.css";
import PageViewTracker from "./PageViewTracker";

const SITE_URL = "https://exkey-app.vercel.app";
const TITLE = "ExKey · 關鍵人脈媒合平台";
const DESCRIPTION = "沒關係 找 關係 的關鍵人脈網。業務與廠商互相介紹人脈，自動媒合你想認識的關鍵人脈。";

// 分享到 LINE、Facebook 時顯示的標題、說明與預覽圖。
// 預覽圖是同一個資料夾裡的 opengraph-image.png，小圖示是 icon.svg，檔名不能改。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ExKey",
    locale: "zh_TW",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="font-sans bg-purple-50 text-gray-900 min-h-screen">
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}
