import Link from "next/link";
import { AddNewItemCategoryOwnerOrStatusMenu } from "@/components/add-new-item-category-owner-or-status-menu";
import { LogoMark, NavigationBar } from "@/components/navigation-bar";

// The frame around every page
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavigationBar />
      <main className="md:ml-60">
        <header className="sticky top-0 z-30 flex items-center border-b bg-background/90 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur md:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <LogoMark />
            createMPLS
          </Link>
          <div className="ml-auto">
            <AddNewItemCategoryOwnerOrStatusMenu />
          </div>
        </header>
        <div className="px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </>
  );
}
