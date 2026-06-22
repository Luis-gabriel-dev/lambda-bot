import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lambda.adastratech.dev"),
  title: {
    default: "Lambda — All-in-one Discord Bot",
    template: "%s — Lambda",
  },
  description:
    "Lambda is a powerful all-in-one Discord bot: moderation, automod, a kurocoins economy with a casino, tickets, server partnerships, a mini-Instagram, giveaways and welcome messages — all managed from a clean web dashboard.",
  keywords: [
    "discord bot",
    "discord moderation bot",
    "discord economy bot",
    "discord tickets",
    "automod",
    "discord dashboard",
  ],
  openGraph: {
    title: "Lambda — All-in-one Discord Bot",
    description:
      "Moderation, economy, casino, tickets, partnerships and more — configured from a clean web dashboard.",
    type: "website",
    url: "https://lambda.adastratech.dev",
    siteName: "Lambda",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
