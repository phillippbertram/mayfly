import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { asset, basePath } from "@/lib/paths";
import "./globals.css";

// Brand display face, self-hosted from @fontsource-variable (OFL-1.1). next/font keeps
// the preload under the Pages base path.
const display = localFont({
  src: "../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phillippbertram.github.io";
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Mayfly Share — Files that live for a moment.", template: "%s · Mayfly" },
  description:
    "Temporary local file sharing from your desktop. Share files with one link, scan a QR code, or download everything as a ZIP. Public release in development.",
  alternates: { canonical: `${basePath}/` },
  icons: { icon: asset("/icon.svg") },
  openGraph: {
    title: "Mayfly Share — Files that live for a moment.",
    description:
      "One file or a few. One link. One quick QR scan. Explore the current desktop features and user manual.",
    type: "website",
    images: [
      {
        url: asset("/screenshots/dashboard.jpg"),
        width: 1440,
        height: 960,
        alt: "Mayfly interface preview with sample files",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
