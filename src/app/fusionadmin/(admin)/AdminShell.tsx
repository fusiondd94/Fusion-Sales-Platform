"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FileText,
  FormInput,
  Library,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  UsersRound,
  UserRoundCog
} from "lucide-react";
import { signOutFusionAdmin } from "@/app/fusionadmin/actions";
import type { FusionAdminUser } from "@/lib/auth";

const navItems = [
  { href: "/fusionadmin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fusionadmin/clients", label: "Clients", icon: UsersRound },
  { href: "/fusionadmin/deals", label: "Deals", icon: BriefcaseBusiness },
  { href: "/fusionadmin/services", label: "Services", icon: Library },
  { href: "/fusionadmin/proposals", label: "Proposals", icon: FileText },
  { href: "/fusionadmin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/fusionadmin/email-templates", label: "Email", icon: Mail },
  { href: "/fusionadmin/forms", label: "Forms", icon: FormInput },
  { href: "/fusionadmin/reports", label: "Reports", icon: BarChart3 },
  { href: "/fusionadmin/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/fusionadmin/team", label: "Team", icon: UserRoundCog },
  { href: "/fusionadmin/settings", label: "Settings", icon: Settings }
];

export function AdminShell({ children, user }: { children: ReactNode; user: FusionAdminUser }) {
  const pathname = usePathname();

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/" className="ghost-button">
            <BarChart3 size={16} /> Sales page
          </Link>
          <form action={signOutFusionAdmin}>
            <button className="ghost-button" type="submit">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Backend</p>
            <h1>Fusion platform admin</h1>
          </div>
          <div className="admin-user-card">
            <span>Signed in as</span>
            <strong>{user.displayName}</strong>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
