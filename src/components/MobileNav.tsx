"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import type { NavItemDef } from "./Sidebar";

/* ── Mobile Header ────────────────────────────────────────────────────── */

export function MobileHeader({
  onMenuOpen,
  pageTitle,
  action,
}: {
  onMenuOpen: () => void;
  pageTitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-3 md:hidden">
      <button
        onClick={onMenuOpen}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 active:bg-gray-100"
        aria-label="Open navigation menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      <span className="flex-1 truncate text-center text-sm font-semibold text-gray-900">
        {pageTitle}
      </span>
      {action ?? <div className="w-11 shrink-0" />}
    </header>
  );
}

/* ── Mobile Drawer ────────────────────────────────────────────────────── */

export function MobileDrawer({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavItemDef[];
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const touchStartX = useRef(0);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on route change
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (diff < -60) onClose();
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-gray-900/50 transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Logo + Close */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">PrivacyPilot</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 active:bg-gray-100"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              if (item.requiresRole && (!userRole || !item.requiresRole.includes(userRole))) return null;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "bg-brand-50 text-brand-700" : "text-gray-700 active:bg-gray-100"
                    }`}
                  >
                    <span className={active ? "text-brand-600" : "text-gray-400"}>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User & Sign out */}
        {session?.user && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {session.user.name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-gray-900">{session.user.name}</p>
                <p className="truncate text-xs text-gray-500">{session.user.role.replace(/_/g, " ")}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors active:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Bottom Navigation (4 items: Home, Cases, Copilot, More)                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** Routes that live inside the "More" sheet — used for active-state detection */
const MORE_ROUTES = ["/tasks", "/documents", "/integrations", "/governance", "/settings"];

/* ── Menu item definition ────────────────────────────────────────────── */

interface MoreMenuItem {
  label: string;
  href: string;
  /** If set, item only visible when user role is in this list */
  requiresRole?: string[];
  icon: React.ReactNode;
}

/* ── Group A: Work ───────────────────────────────────────────────────── */

const GROUP_WORK: MoreMenuItem[] = [
  {
    label: "Tasks",
    href: "/tasks",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Documents",
    href: "/documents",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

/* ── Group B: Platform ───────────────────────────────────────────────── */

const GROUP_PLATFORM: MoreMenuItem[] = [
  {
    label: "Integrations",
    href: "/integrations",
    // INTEGRATIONS_VIEW is granted to every role in the RBAC matrix
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
];

/* ── Group C: Administration ─────────────────────────────────────────── */

const GROUP_ADMIN: MoreMenuItem[] = [
  {
    label: "Settings",
    href: "/settings",
    // TENANT_SETTINGS_EDIT: SUPER_ADMIN, TENANT_ADMIN
    requiresRole: ["SUPER_ADMIN", "TENANT_ADMIN"],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Governance",
    href: "/governance",
    // GOVERNANCE_VIEW: SUPER_ADMIN, TENANT_ADMIN, DPO, CASE_MANAGER, AUDITOR
    requiresRole: ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER", "AUDITOR"],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

/* ── Group definition used by MoreSheet ──────────────────────────────── */

interface MenuGroup {
  id: string;
  label: string;
  items: MoreMenuItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  { id: "work", label: "Work", items: GROUP_WORK },
  { id: "platform", label: "Platform", items: GROUP_PLATFORM },
  { id: "admin", label: "Admin", items: GROUP_ADMIN },
];

/* ── BottomNav ───────────────────────────────────────────────────────── */

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const isMoreActive = MORE_ROUTES.some((p) => pathname.startsWith(p));

  return (
    <>
      {/* Bottom Sheet */}
      <MoreSheet
        open={sheetOpen}
        onClose={closeSheet}
        userRole={userRole}
        userName={session?.user?.name}
        userRoleLabel={session?.user?.role}
      />

      {/* Fixed bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch">
          {/* Home */}
          <NavTab href="/dashboard" label="Home" active={isActive("/dashboard")}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </NavTab>

          {/* Cases */}
          <NavTab href="/cases" label="Cases" active={isActive("/cases")}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </NavTab>

          {/* Copilot */}
          <NavTab href="/copilot" label="Copilot" active={isActive("/copilot")}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </NavTab>

          {/* More */}
          <button
            onClick={sheetOpen ? closeSheet : openSheet}
            className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              sheetOpen || isMoreActive ? "text-brand-600" : "text-gray-500 active:text-gray-700"
            }`}
          >
            <span className="relative">
              <svg
                className={`h-5 w-5 ${sheetOpen || isMoreActive ? "text-brand-600" : "text-gray-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              {/* Active-in-more dot indicator */}
              {isMoreActive && !sheetOpen && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-500" />
              )}
            </span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}

/* ── Nav Tab (link item for bottom bar) ──────────────────────────────── */

function NavTab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
        active ? "text-brand-600" : "text-gray-500 active:text-gray-700"
      }`}
    >
      <span className={active ? "text-brand-600" : "text-gray-400"}>{children}</span>
      {label}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  More Bottom Sheet                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

function MoreSheet({
  open,
  onClose,
  userRole,
  userName,
  userRoleLabel,
}: {
  open: boolean;
  onClose: () => void;
  userRole?: string;
  userName?: string;
  userRoleLabel?: string;
}) {
  const pathname = usePathname();
  const touchStartY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Reset sign-out confirmation when sheet closes
  useEffect(() => {
    if (!open) setConfirmingSignOut(false);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientY - touchStartY.current;
    if (diff > 60) onClose(); // swipe down to dismiss
  }

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  /** Filter items by role, return only groups that have visible items */
  function visibleGroups(): MenuGroup[] {
    return MENU_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.requiresRole) return true;
          return userRole && item.requiresRole.includes(userRole);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }

  const groups = visibleGroups();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-gray-900/40 transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-white shadow-xl transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <div className="flex-1">
            {/* Drag handle */}
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" />
            <h2 className="text-base font-semibold text-gray-900">More</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grouped Navigation Items */}
        <nav className="px-3 pb-1">
          {groups.map((group, gi) => (
            <div key={group.id}>
              {/* Divider between groups (not before the first) */}
              {gi > 0 && <div className="mx-2 my-1.5 border-t border-gray-100" />}

              {/* Group label */}
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </p>

              <ul>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-brand-50 text-brand-700"
                            : "text-gray-700 active:bg-gray-100"
                        }`}
                      >
                        <span className={active ? "text-brand-600" : "text-gray-400"}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {active && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                            Current
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Divider + Account section */}
        <div className="mx-5 border-t border-gray-100" />
        <div className="px-3 pb-3 pt-1.5">
          <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Account
          </p>

          {/* Profile row */}
          {userName && (
            <div className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {userName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
                {userRoleLabel && (
                  <p className="truncate text-xs text-gray-500">
                    {userRoleLabel.replace(/_/g, " ")}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Sign out / confirmation */}
          {confirmingSignOut ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">Sign out?</p>
              <p className="mt-0.5 text-xs text-gray-500">
                You&apos;ll need to sign in again to access your account.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirmingSignOut(false)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 active:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white active:bg-red-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingSignOut(true)}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors active:bg-gray-100"
            >
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          )}
        </div>
      </div>
    </>
  );
}
