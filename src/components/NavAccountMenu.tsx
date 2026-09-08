"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MonitorUp, Settings, ShoppingCart, UserRound } from "lucide-react";
import { signOutFusionAdmin } from "@/app/fusionadmin/actions";
import { SignOutButton } from "@/components/ui";

export function NavAccountMenu({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!open) return;

          function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setOpen(false);
            }
          }
  function handleEscape(event: KeyboardEvent) {
    if (event.key === "Escape") setOpen(false);
  }

          document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("keydown", handleEscape);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEscape);
  };
}, [open]);

return (
  <div className="nav-user-menu" data-open={open ? "true" : "false"} ref={menuRef}>
<button
aria-expanded={open}
aria-haspopup="true"
className="nav-user-menu__trigger"
onClick={() => setOpen((value) => !value)}
type="button"
>
<UserRound size={16} />
<span>Signed in</span>
<ChevronDown className="chevron" size={14} />
</button>
{open ? (
  <div className="nav-user-dropdown" role="menu">
  <div className="nav-user-dropdown__heading">
 <small>Signed in as</small>
 <strong>{displayName}</strong>
 </div>
 <a className="nav-user-dropdown__item" href="/fusionadmin/settings" onClick={() => setOpen(false)} role="menuitem">
<Settings size={16} /> View account
</a>
<a className="nav-user-dropdown__item" href="#ecommerce-tiers" onClick={() => setOpen(false)} role="menuitem">
<ShoppingCart size={16} /> Buy new service
</a>
<a className="nav-user-dropdown__item" href="/portal" onClick={() => setOpen(false)} role="menuitem">
<MonitorUp size={16} /> Access portal
</a>
<div className="nav-user-dropdown__divider" />
<div className="nav-user-dropdown__item nav-user-dropdown__item--signout">
<SignOutButton action={signOutFusionAdmin} />
</div>
</div>
) : null}
</div>
);
}
