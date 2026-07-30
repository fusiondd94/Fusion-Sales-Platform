"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  FormInput,
  Kanban,
  Library,
  LayoutDashboard,
  Mail,
  MessageCircle,
  MonitorUp,
  Settings,
  UsersRound,
  UserRoundCog,
  Zap
} from "lucide-react";
import { markAllFusionNotificationsRead, markFusionNotificationRead, signOutFusionAdmin } from "@/app/fusionadmin/actions";
import { FusionAvatar } from "@/app/fusionadmin/(admin)/crm-ui";
import { AdminFeedbackBoundary, SignOutButton } from "@/components/ui";
import type { FusionAdminUser } from "@/lib/auth";
import type { AdminNotification } from "@/lib/portal";

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
      { href: "/fusionadmin/email", label: "Email", icon: Mail, description: "Campaigns & templates" },
      { href: "/fusionadmin/forms", label: "Forms", icon: FormInput, description: "Lead capture" }
    ]
  },
  {
    label: "Marketing",
    items: [
      { href: "/fusionadmin/content", label: "Content", icon: CalendarClock, description: "Post scheduler" }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/fusionadmin/calendar", label: "Calendar", icon: CalendarDays, description: "Meetings" },
      { href: "/fusionadmin/tasks", label: "Tasks", icon: ClipboardList, description: "Work queue" },
      { href: "/fusionadmin/task-board", label: "Task Board", icon: Kanban, description: "Client kanban" }
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
    label: "Messaging",
    items: [
      { href: "/fusionadmin/messages", label: "Messages", icon: MessageCircle, description: "Unified inbox" }
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
const COLLAPSED_SECTIONS_KEY = "fusion-admin-collapsed-sections";

export function AdminShell({
  children,
  notifications,
  user,
  logoUrl
}: {
  children: ReactNode;
  notifications: AdminNotification[];
  user: FusionAdminUser;
  logoUrl?: string | null;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const pathname = usePathname();

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    try {
      const storedSections = window.localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (storedSections) setCollapsedSections(new Set(JSON.parse(storedSections) as string[]));
    } catch {
      // Ignore malformed/unavailable storage.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "true" : "false");
  }, [collapsed, hydrated]);

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

  const allNavItems = navSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
  const activeItem = allNavItems.find((item) => pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`))) || allNavItems[0];

  return (
    <main className="admin-app" data-sidebar-collapsed={collapsed ? "true" : "false"}>
      <aside className="admin-sidebar">
        <div className="admin-brand-row">
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
          {navSections.map((section) => {
            const sectionHasActiveItem = section.items.some(
              (item) => pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`))
            );
            const isSectionCollapsed = collapsedSections.has(section.label) && !sectionHasActiveItem && !collapsed;

            return (
              <section className="admin-menu-section" key={section.label}>
                <button
                  aria-expanded={!isSectionCollapsed}
                  className="admin-menu-section-toggle"
                  data-collapsed={isSectionCollapsed ? "true" : "false"}
                  onClick={() => toggleSection(section.label)}
                  type="button"
                >
                  <span>{section.label}</span>
                  <ChevronDown size={14} />
                </button>
                {!isSectionCollapsed ? (
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
                ) : null}
              </section>
            );
          })}
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
          <div className="admin-notif-bell">
            <button className="ghost-button" onClick={() => setNotifOpen((value) => !value)} type="button">
              <Bell size={16} />
              {unreadCount > 0 ? <span className="admin-notif-badge">{unreadCount}</span> : null}
            </button>
            {notifOpen ? (
              <div className="admin-notif-dropdown">
                <div className="admin-notif-dropdown__heading">
                  <strong>Notifications</strong>
                  {unreadCount > 0 ? (
                    <form action={markAllFusionNotificationsRead}>
                      <button className="text-link" type="submit">Mark all read</button>
                    </form>
                  ) : null}
                </div>
                <div className="admin-notif-list">
                  {notifications.length ? (
                    notifications.map((notification) => (
                      <form action={markFusionNotificationRead} key={notification.id}>
                        <input name="notificationId" type="hidden" value={notification.id} />
                        <button className={notification.read_at ? "admin-notif-item" : "admin-notif-item admin-notif-item--unread"} type="submit">
                          <strong>{notification.title}</strong>
                          {notification.body ? <p>{notification.body}</p> : null}
                          <span className="muted">{new Date(notification.created_at).toLocaleString()}</span>
                        </button>
                      </form>
                    ))
                  ) : (
                    <p className="admin-empty">No notifications yet.</p>
                  )}
                </div>
              </div>
            ) : null}
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
