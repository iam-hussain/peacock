import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const DESCRIPTION = "Many feathers, one fortune. Every rupee your club holds, in plain sight.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://peacock.club"),
  title: {
    default: "Peacock Investment Club",
    template: "%s · Peacock",
  },
  description: DESCRIPTION,
  applicationName: "Peacock",
  keywords: ["investment club", "chit fund", "member deposits", "loans", "Peacock"],
  openGraph: {
    type: "website",
    siteName: "Peacock Investment Club",
    title: "Peacock Investment Club",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Peacock Investment Club",
    description: DESCRIPTION,
  },
  appleWebApp: { capable: true, title: "Peacock", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0E8C82" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1413" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
