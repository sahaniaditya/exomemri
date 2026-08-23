import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionSync from "@/components/SessionSync";
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
  title: "exomemri",
  description: "Your AI learning memory",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
       
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.style.backgroundColor = "#F4F1E9";`,
          }}
        />
      </head>
      <body 
        className="min-h-full flex flex-col"
        style={{ backgroundColor: "#F4F1E9" }}
      >
        {children}
        <SessionSync />
      </body>
    </html>
  );
}