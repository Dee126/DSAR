"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Sidebar, { NAV_ITEMS } from "@/components/Sidebar";
import { MobileHeader, MobileDrawer, BottomNav } from "@/components/MobileNav";
import NotificationBell from "@/components/NotificationBell";

/* ── Page title from pathname ──────────────────────────────────────── */

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cases": "Cases",
  "/cases/new": "New Case",
  "/tasks": "Tasks",
  "/documents": "Documents",
  "/copilot": "Privacy Copilot",
  "/data-inventory": "Data Inventory",
  "/integrations": "Integrations",
  "/governance": "Governance",
  "/governance/sla": "SLA Configuration",
  "/heatmap": "Risk Heatmap",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/cases/")) return "Case Detail";
  if (pathname.startsWith("/data-inventory/")) return "System Detail";
  if (pathname.startsWith("/heatmap/finding/")) return "Finding Detail";
  if (pathname.startsWith("/heatmap/system/")) return "System Findings";
  if (pathname.startsWith("/governance/")) return "Governance";
  if (pathname.startsWith("/integrations/")) return "Integration";
  return "PrivacyPilot";
}

/* ── Layout ────────────────────────────────────────────────────────── */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleDrawerClose = useCallback(() => setDrawerOpen(false), []);
  const handleDrawerOpen = useCallback(() => setDrawerOpen(true), []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="h-8 w-8 animate-spin text-brand-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="fixed inset-y-0 left-0 z-30 hidden w-64 md:block">
        <Sidebar />
      </div>

      {/* Mobile header — visible below md */}
      <MobileHeader onMenuOpen={handleDrawerOpen} pageTitle={pageTitle} action={<NotificationBell />} />

      {/* Mobile drawer overlay */}
      <MobileDrawer open={drawerOpen} onClose={handleDrawerClose} navItems={NAV_ITEMS} />

      {/* Main content */}
      <main className="w-full flex-1 md:ml-64">
        {/* Desktop notification bell */}
        <div className="hidden md:flex items-center justify-end px-8 pt-4 pb-0">
          <NotificationBell />
        </div>
        <div className="px-4 pb-24 pt-[4.25rem] md:px-8 md:pt-2 md:pb-8">{children}</div>
      </main>

      {/* Mobile bottom nav — visible below md */}
      <BottomNav />
    </div>
  );
}
