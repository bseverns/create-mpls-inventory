import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const figtreeFont = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "createMPLS Inventory",
  description: "Inventory for createMPLS STEM programs",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page use the full screen on phones with a notch
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

// The outer page
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={figtreeFont.variable}>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "rounded-lg border bg-card text-card-foreground shadow-lg",
            },
          }}
        />
      </body>
    </html>
  );
}
