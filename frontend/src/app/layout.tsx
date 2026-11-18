import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { NavigationTransitionProvider } from "@/components/layout/NavigationTransition";
import { connection } from "next/server";
import { api } from "@/lib/api/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Serif for selected editorial headings only; all figures, tables and labels use Geist.
const displaySerif = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sephora Business Insight",
  description: "Business intelligence on the Sephora product catalogue and its Skincare reviews.",
};

async function apiStatus() {
  await connection(); // the shell shows live API status on every request
  try {
    const h = await api.health();
    return { connected: true, datasetAvailable: h.dataset_available };
  } catch {
    return { connected: false, datasetAvailable: false };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const status = await apiStatus();
  return (
    <html lang="en" className={`${geistSans.variable} ${displaySerif.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <NavigationTransitionProvider>
          <AppShell status={status}>{children}</AppShell>
        </NavigationTransitionProvider>
      </body>
    </html>
  );
}
