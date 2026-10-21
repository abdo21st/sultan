import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { Providers } from "./providers";
import BottomNav from "./components/BottomNav";
import { ToastProvider } from "./components/ToastProvider";
import OnlineRequired from "./components/OnlineRequired";
import RetireOfflineSupport from "./components/RetireOfflineSupport";
import LegacyDraftNotice from "./components/LegacyDraftNotice";
import { Toaster } from "react-hot-toast";

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سلطان - إدارة الطلبات",
  description: "نظام إدارة الطلبات والمعاملات",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sultan",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#b45309",
};

// ...

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="ar" dir="rtl" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${cairo.variable} font-sans antialiased`}
      >
        <Providers session={session}>
          <RetireOfflineSupport />
          <ToastProvider>
            <OnlineRequired>
              <LegacyDraftNotice />
              {children}
              <BottomNav />
            </OnlineRequired>
            <Toaster position="top-center" />
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}

