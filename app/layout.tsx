import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "OrderFlow",
  description: "Internal order management system",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OrderFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakarta.variable} font-sans transition-colors duration-200`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              marginBottom: '80px',
              background: 'color-mix(in oklch, var(--card) 95%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.18)',
              borderRadius: '12px',
              fontWeight: 600,
            },
          }}
        />
      </body>
    </html>
  );
}
