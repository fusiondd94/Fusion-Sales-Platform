"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
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
      { href: "/fusionadmin/email-templates", label: "Email", icon: Mail, description: "Templates" },
      { href: "/fusionadmin/forms", label: "Forms", icon: FormInput, description: "Lead capture" }
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

export function AdminShell({ children, notifications, user }: { children: ReactNode; notifications: AdminNotification[]; user: FusionAdminUser }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const pathname = usePathname();
  const allNavItems = navSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
  const activeItem = allNavItems.find((item) => pathname === item.href || (item.href !== "/fusionadmin" && pathname.startsWith(`${item.href}/`))) || allNavItems[0];

  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/fusionadmin">
          <span className="brand-mark">FDD</span>
          <span>
            <strong>Fusion CRM</strong>
            <small>Admin workspace</small>
          </span>
        </Link>
        <nav className="admin-menu" aria-label="Fusion admin navigation">
          {navSections.map((section) => (
            <section className="admin-menu-section" key={section.label}>
              <p>{section.label}</p>
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
            </section>
          ))}
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
