import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://onsite.supportportal.ai"),
  title: {
    default: "现场通 OnSite",
    template: "%s · 现场通 OnSite",
  },
  description: "现场签到、工时记录与项目报告平台。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: ["en_US", "es_ES", "ko_KR"],
    url: "/",
    siteName: "现场通 OnSite",
    title: "现场通 OnSite",
    description: "现场签到与项目报告 · 简单、可靠、可审计",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "现场通 OnSite — 现场签到与项目报告" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "现场通 OnSite",
    description: "现场签到与项目报告 · 简单、可靠、可审计",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
