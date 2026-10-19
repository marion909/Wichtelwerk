import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";
import { RegisterServiceWorker } from "@/components/register-sw";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:4000"),
  title: { default: "Wichtelwerk", template: "%s · Wichtelwerk" },
  description: "Wichteln für die ganze Firma – in 10 Minuten aufgesetzt, DSGVO-konform und EU-gehostet.",
  applicationName: "Wichtelwerk",
  appleWebApp: { capable: true, title: "Wichtelwerk", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#173f35",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getT();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
