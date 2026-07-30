"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  FormInput,
  Library,
  LayoutDashboard,
  Mail,
  MonitorUp,
  Settings,
  UsersRound,
  UserRoundCog,
  Zap
} from "lucide-react";
import { signOutFusionAdmin } from "@/app/fusionadmin/actions";
import { FusionAvatar } from "@/app/fusionadmin/(admin)/crm-ui";
import { AdminFeedbackBoundary, SignOutButton } from "@/components/ui";
import type { FusionAdminUser } from "@/lib/auth";

const navSections = [
  {
    label: "Core",
    items: [
      { href: "/fusionadmin", label: "Dashboard", icon: LayoutDashboard, description: "Command center" }
    ]
  },
  {
    label: "CRM",
    items: [
      { href: "/fusionadmin/clients", label: "Clients", icon: UsersRound, description: "Leads and contacts" },
      { href: "/fusionadmin/deals", label: "Deals", icon: BriefcaseBusiness, description: "Pipeline" }
    ]
  },
  {
    label: "Sales",
    items: [
      { href: "/fusionadmin/services", label: "Services", icon: Library, description: "Offer catalog" },
      { href: "/fusionadmin/proposals", label: "Proposals", icon: FileText, description: "Quotes and packages" },
      { href: "/fusionadmin/email-templates", label: "Email", icon: Mail, description: "Templates" },
      { href: "/fusionadmin/forms", label: "Forms", icon: FormInput, description: "Lead capture" }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/fusionadmin/calendar", label: "Calendar", icon: CalendarDays, description: "Meetings" },
      { href: "/fusionadmin/tasks", label: "Tasks", icon: ClipboardList, description: "Work queue" }
    ]
  },
  {
    label: "Insights",
    items: [
      { href: "/fusionadmin/reports", label: "Reports", icon: BarChart3, description: "Performance" }
    ]
  },
  {
    label: "Automation",
    items: [
      { href: "/fusionadmin/automations", label: "Automations", icon: Zap, description: "Rules and triggers" }
    ]
  },
  {
    label: "Administration",
    items: [
      { href: "/fusionadmin/team", label: "Team", icon: UserRoundCog, description: "Users and roles" },
      { href: "/fusionadmin/settings", label: "Settings", icon: Settings, description: "Pricing and brand" }
    ]
  }
];

const COLLAPSED_SECTIONS_KEY = "fusion-admin-collapsed-sections";

export function AdminShell({
  children,
  user,
  logoUrl
}: {
  children: ReactNode;
  user: FusionAdminUser;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const allNavItems = navSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
  const activeItem = allNavItems.find((item) => pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`))) || allNavItems[0];

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (stored) setCollapsedSections(new Set(JSON.parse(stored) as string[]));
    } catch {
      // Ignore malformed/unavailable storage.
    }
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userMenuOpen]);

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      try {
        window.localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...next]));
      } catch {
        // Ignore unavailable storage.
      }
      return next;
    });
  }

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/fusionadmin">
          {logoUrl ? (
            <img alt="Brand logo" className="brand-mark brand-mark--logo" src={logoUrl} />
          ) : (
            <span className="brand-mark">FDD</span>
          )}
          <span>
            <strong>Fusion CRM</strong>
            <small>Admin workspace</small>
          </span>
        </Link>
        <nav className="admin-menu" aria-label="Fusion admin navigation">
          {navSections.map((section) => {
            const sectionHasActiveItem = section.items.some(
              (item) => pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`))
            );
            const isCollapsed = collapsedSections.has(section.label) && !sectionHasActiveItem;

            return (
              <section className="admin-menu-section" key={section.label}>
                <button
                  aria-expanded={!isCollapsed}
                  className="admin-menu-section-toggle"
                  data-collapsed={isCollapsed ? "true" : "false"}
                  onClick={() => toggleSection(section.label)}
                  type="button"
                >
                  <span>{section.label}</span>
                  <ChevronDown size={14} />
                </button>
                {!isCollapsed ? (
                  <div>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`));

                      return (
                        <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} key={item.href}>
                          <Icon size={17} />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/portal" className="ghost-button">
            <MonitorUp size={16} /> Client portal
          </Link>
          <Link href="/" className="ghost-button">
            <BarChart3 size={16} /> Sales site
          </Link>
          <SignOutButton action={signOutFusionAdmin} />
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">{activeItem.section}</p>
            <h1>{activeItem.label}</h1>
            <span>{activeItem.description}</span>
          </div>
          <div className="admin-user-menu" data-open={userMenuOpen ? "true" : "false"} ref={userMenuRef}>
            <button
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              className="admin-user-card admin-user-card--button"
              onClick={() => setUserMenuOpen((open) => !open)}
              type="button"
            >
              <FusionAvatar name={user.displayName || user.email} />
              <span>
                <small>Signed in as</small>
                <strong>{user.displayName}</strong>
              </span>
              <ChevronDown className="chevron" size={16} />
            </button>
            {userMenuOpen ? (
              <div className="admin-user-dropdown" role="menu">
                <Link className="admin-user-dropdown__item" href="/fusionadmin/settings" onClick={() => setUserMenuOpen(false)} role="menuitem">
                  <Settings size={16} /> Account settings
                </Link>
                <Link className="admin-user-dropdown__item" href="/portal" onClick={() => setUserMenuOpen(false)} role="menuitem">
                  <MonitorUp size={16} /> Client portal
                </Link>
                <Link className="admin-user-dropdown__item" href="/" onClick={() => setUserMenuOpen(false)} role="menuitem">
                  <BarChart3 size={16} /> Sales site
                </Link>
                <div className="admin-user-dropdown__divider" />
                <div className="admin-user-dropdown__item admin-user-dropdown__item--signout">
                  <SignOutButton action={signOutFusionAdmin} />
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <AdminFeedbackBoundary>{children}</AdminFeedbackBoundary>
      </section>
    </main>
  );
}
