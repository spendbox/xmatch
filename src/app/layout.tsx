import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { NavProgress } from "@/components/ui/NavProgress";
import { TapFeedback } from "@/components/ui/TapFeedback";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dashpad.site"),
  title: { default: "Dashpad — Your world, your people", template: "%s · Dashpad" },
  description:
    "Dashpad pairs you with someone new every hour. Chat masked, and unmask only if you both say yes.",
  openGraph: {
    title: "Dashpad",
    description: "A new masked pair every hour. Unmask only if you both say yes.",
    url: "https://dashpad.site",
    siteName: "Dashpad",
    type: "website",
  },
  appleWebApp: { capable: true, title: "Dashpad", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // Android: shrink the page when the keyboard opens, so inputs stay visible
  interactiveWidget: "resizes-content",
  themeColor: "#faf7f2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Remember a folded side menu without a flash on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('dp-sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh">
        <NavProgress />
        <TapFeedback />
        {children}
      </body>
    </html>
  );
}
