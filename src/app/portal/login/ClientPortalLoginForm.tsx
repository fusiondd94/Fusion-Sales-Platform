"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { signInClientPortal } from "@/app/portal/actions";

export function ClientPortalLoginForm() {
  const [state, formAction, pending] = useActionState(signInClientPortal, { error: "" });

  return (
    <form className="login-card" action={formAction}>
      <div className="login-icon"><LockKeyhole size={24} /></div>
      <p className="eyebrow">Client portal</p>
      <h1>Review your Fusion website project.</h1>
      <p className="muted">Sign in with the email connected to your Fusion project to upload assets and leave feedback.</p>
      <label>
        Email
        <input name="email" placeholder="you@company.com" type="email" required />
      </label>
      <label>
        Password
        <input name="password" placeholder="Your password" type="password" required />
      </label>
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Signing in..." : "Open portal"}
      </button>
    </form>
  );
}
