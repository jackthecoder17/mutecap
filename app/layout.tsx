import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Montserrat } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
// The face drawn into the captions themselves (variable, so every weight is available to the canvas).
const montserrat = Montserrat({ variable: "--font-caption", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mutecap",
  description:
    "Auto-captions for people who watch on mute. Word-by-word captions burned into your video, made on your own device. Free, no sign-up, no uploads.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
