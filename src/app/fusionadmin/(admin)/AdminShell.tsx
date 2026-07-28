"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  FormInput,
  Library,
  LayoutDashboard,
  Mail,
  MonitorUp,
  Settings,
  UsersRound,
  UserRoundCog
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
    label: "Administration",
    items: [
      { href: "/fusionadmin/team", label: "Team", icon: UserRoundCog, description: "Users and roles" },
      { href: "/fusionadmin/settings", label: "Settings", icon: Settings, description: "Pricing and brand" }
    ]
  }
];

const SIDEBAR_STORAGE_KEY = "fusion-admin-sidebar-collapsed";

export function AdminShell({ children, user }: { children: ReactNode; user: FusionAdminUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "true" : "false");
  }, [collapsed, hydrated]);

  const allNavItems = navSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
  const activeItem = allNavItems.find((item) => pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`))) || allNavItems[0];

  return (
    <main className="admin-app" data-sidebar-collapsed={collapsed ? "true" : "false"}>
      <aside className="admin-sidebar">
        <div className="admin-brand-row">
          <Link className="admin-brand" href="/fusionadmin">
            <span className="brand-mark">FDD</span>
            <span>
              <strong>Fusion CRM</strong>
              <small>Admin workspace</small>
            </span>
          </Link>
          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
        <nav className="admin-menu" aria-label="Fusion admin navigation">
          {navSections.map((section) => (
            <section className="admin-menu-section" key={section.label}>
              <p>{section.label}</p>
              <div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={active ? "active" : ""}
                      href={item.href}
                      key={item.href}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={17} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/portal" className="ghost-button" title={collapsed ? "Client portal" : undefined}>
            <MonitorUp size={16} /> <span>Client portal</span>
          </Link>
          <Link href="/" className="ghost-button" title={collapsed ? "Sales site" : undefined}>
            <BarChart3 size={16} /> <span>Sales site</span>
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
          <div className="admin-user-card">
            <FusionAvatar name={user.displayName || user.email} />
            <span>
              <small>Signed in as</small>
              <strong>{user.displayName}</strong>
            </span>
          </div>
        </header>
        <AdminFeedbackBoundary>{children}</AdminFeedbackBoundary>
      </section>
    </main>
  );
}
