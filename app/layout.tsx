import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سلطان - إدارة الطلبات",
  description: "نظام إدارة الطلبات والمعاملات",
  manifest: "/manifest.json",
  themeColor: "#b45309",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sultan",
  },
};

import { auth } from "../auth";
import { Providers } from "./providers";

// ...

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${cairo.variable} font-sans antialiased`}
      >
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
