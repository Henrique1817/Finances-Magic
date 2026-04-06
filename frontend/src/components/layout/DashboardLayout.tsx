"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { AddAssetModalProvider } from "@/contexts/AddAssetModalContext";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const isSimulator = pathname === "/simulator";

  return (
    <AddAssetModalProvider>
      <div className="flex min-h-dvh">
        {!isSimulator ? (
          <div className="hidden md:block">
            <Sidebar />
          </div>
        ) : null}

        {!isSimulator && mobileNav ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              aria-label="Fechar menu"
              onClick={() => setMobileNav(false)}
            />
            <div className="absolute left-0 top-0 h-full max-h-dvh max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto shadow-2xl">
              <Sidebar onNavigate={() => setMobileNav(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <TopHeader
            onOpenSidebar={() => setMobileNav(true)}
            variant={isSimulator ? "simulator" : "default"}
          />
          <main
            className={
              isSimulator
                ? "flex min-h-0 flex-1 flex-col overflow-hidden p-0"
                : "flex-1 overflow-x-hidden px-3 py-5 sm:px-5 sm:py-6 md:px-8 md:py-10"
            }
          >
            {children}
          </main>
        </div>
      </div>
    </AddAssetModalProvider>
  );
}
