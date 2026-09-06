import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: "Kaffey. Coffee for the curious.",
  description: "Small-batch coffee, honest food, and a corner of the city made for lingering.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("kaffey-sidebar-collapsed")==="true")document.body.classList.add("sidebar-collapsed")}catch(e){}`,
          }}
        />
        <Toaster>
          {children}
        </Toaster>
        <Analytics />
      </body>
    </html>
  );
}
