"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";

type LayoutProps = {
  sidebar?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function Layout({ sidebar, header, footer, children }: LayoutProps) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
    );
  }, []);

  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(
      headerRef.current.querySelectorAll("[data-header-item]"),
      { opacity: 0, y: -6 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: "power2.out" },
    );
  }, []);

  const links = [
    { href: "/", label: "Painel" },
    { href: "/wallet", label: "Carteira" },
    { href: "/simulator", label: "Simulador" },
  ];

  return (
    <div className="immersive-shell">
      {sidebar ? (
        <aside className="immersive-sidebar hidden md:block">
          <div className="simulator-rail-scroll h-full overflow-y-auto overflow-x-hidden">{sidebar}</div>
        </aside>
      ) : null}

      <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden ${sidebar ? "md:ml-64" : ""}`}>
        <header
          ref={headerRef}
          className={`immersive-header ${sidebar ? "md:left-64" : ""}`}
        >
          <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
            {header ?? (
              <>
                <div
                  data-header-item
                  className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200/90"
                >
                  Code Chroma
                </div>
                <nav className="flex items-center gap-1">
                  {links.map((link) => {
                    const active = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        data-header-item
                        className={`group relative rounded-lg px-2.5 py-1.5 text-xs transition-all duration-200 ${
                          active ? "text-white" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        {link.label}
                        <span
                          className={`absolute inset-x-2 -bottom-[2px] h-px origin-left bg-white/70 transition-transform duration-200 ${
                            active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                          }`}
                        />
                      </Link>
                    );
                  })}
                </nav>
              </>
            )}
          </div>
        </header>

        <main className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-14 [scroll-behavior:smooth]">
          <div ref={contentRef} className="relative min-h-full pb-44">
            {children}
          </div>
        </main>

        <footer className={`immersive-footer ${sidebar ? "md:left-64" : ""}`}>
          <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
            {footer ?? (
              <p className="text-xs text-slate-300">
                Barra de comandos pronta para acoplar input de cenários.
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
