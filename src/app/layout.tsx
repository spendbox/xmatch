import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { NavProgress } from "@/components/ui/NavProgress";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site"),
  title: { default: "Dashpad — Meet the person before the picture", template: "%s · Dashpad" },
  description:
    "Dashpad is dating for personality. Chat masked for 5 minutes. Unmask only if you both say yes.",
  openGraph: {
    title: "Dashpad",
    description: "Chat masked for 5 minutes. Unmask only if you both say yes.",
    url: "https://dashpad.site",
    siteName: "Dashpad",
    type: "website",
  },
  appleWebApp: { capable: true, title: "Dashpad", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
