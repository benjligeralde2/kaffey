import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { CapacitorProvider } from "@/components/capacitor-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import { BrewingLoader } from "@/components/brewing-loader";
import { PwaProvider } from "@/components/pwa-provider";
import { Toaster } from "@/components/ui/sonner";
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
  applicationName: "Kaffey",
  title: "Kaffey. Coffee for the curious.",
  description: "Small-batch coffee, honest food, and a corner of the city made for lingering.",
  appleWebApp: {
    capable: true,
    title: "Kaffey",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#263234",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("kaffey-sidebar-collapsed")==="true")document.body.classList.add("sidebar-collapsed")}catch(e){}`,
          }}
        />
        <Toaster>
          <NavigationProgress />
          <BrewingLoader />
          {children}
        </Toaster>
        <CapacitorProvider />
        <PwaProvider />
        <Analytics />
      </body>
    </html>
  );
}
