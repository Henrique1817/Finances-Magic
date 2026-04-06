import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Background3DLayer } from "@/components/Background3DLayer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Code Chroma",
  description: "Simulador global de risco",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-dvh antialiased">
        <Background3DLayer />
        <div className="relative z-10 min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
