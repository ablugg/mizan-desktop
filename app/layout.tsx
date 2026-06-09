import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond, Noto_Naskh_Arabic } from "next/font/google";
import { LocaleProvider } from "@/contexts/LocaleContext";
import type { Locale } from "@/lib/i18n";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-cormorant",
});

const notoArabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "Mizan — Legal Intelligence",
  description: "AI-powered legal assistant for Saudi and Canadian law",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0d1e38",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Default to Arabic for Saudi-focused desktop app; can be made configurable later
  const locale: Locale = "ar";
  const dir = "rtl";

  return (
    <html lang={locale} dir={dir} className={`${dmSans.variable} ${cormorant.variable} ${notoArabic.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0d1e38" />
      </head>
      <body className={dmSans.className}>
        <LocaleProvider defaultLocale={locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
