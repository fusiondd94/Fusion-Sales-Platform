"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { ConfirmDialog } from "./Dialog";

export function SignOutButton({ action }: { action: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form action={action} ref={formRef}>
        <button
          className="ghost-button"
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
          type="button"
        >
          <LogOut size={16} /> Sign out
        </button>
      </form>
      <ConfirmDialog
        cancelLabel="Stay signed in"
        confirmLabel="Sign out"
        description="You will need to sign back in to access the admin workspace."
        onClose={() => setOpen(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        open={open}
        title="Sign out of Fusion CRM?"
        tone="danger"
      />
    </>
  );
}
