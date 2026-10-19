import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/navigation-bar";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found · createMPLS Inventory",
};

// Shown for any web address that does not exist
export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark />
      <p className="mt-6 text-6xl font-semibold tabular-nums">404</p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you are looking for doesn't exist!
      </p>
      <Link href="/" className={`${buttonStyles()} mt-6`}>
        Home
      </Link>
    </main>
  );
}
