import type { Metadata } from "next";
import "./globals.css";
import ModeSimulasiBanner from "@/components/ModeSimulasiBanner";

export const metadata: Metadata = {
  title: "E-Voting OSIM MAN 3 Boyolali",
  description: "Sistem e-voting pemilihan Ketua & Wakil Ketua OSIM MAN 3 Boyolali",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        <ModeSimulasiBanner />
        {children}
      </body>
    </html>
  );
}
