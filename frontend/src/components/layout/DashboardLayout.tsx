"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { AddAssetModalProvider } from "@/contexts/AddAssetModalContext";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <AddAssetModalProvider>
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {mobileNav ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              aria-label="Fechar menu"
              onClick={() => setMobileNav(false)}
            />
            <div className="absolute left-0 top-0 h-full shadow-2xl">
              <Sidebar onNavigate={() => setMobileNav(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader onOpenSidebar={() => setMobileNav(true)} />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </AddAssetModalProvider>
  );
}
