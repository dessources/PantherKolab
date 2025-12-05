import type { Metadata } from "next";

import "@/lib/amplify/amplify-config";
import { Geist, Geist_Mono, Bitter, Fira_Code } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/contexts/AuthContext";
import { ConfigureAmplifyClientSide } from "@/lib/amplify/amplify-config";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bitter = Bitter({
  variable: "--font-bitter",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PantherKolab",
  description:
    "An innovative, student-centric communication platform designed to foster collaboration, creativity, and engagement on campus. Our platform combines real-time messaging, virtual whiteboards, voice notes, and audio/video call capabilities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bitter.variable} ${firaCode.variable} antialiased`}
      >
        <ConfigureAmplifyClientSide />
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-right"
          theme="light"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
            },
            className: 'sonner-toast',
          }}
        />
      </body>
    </html>
  );
}
