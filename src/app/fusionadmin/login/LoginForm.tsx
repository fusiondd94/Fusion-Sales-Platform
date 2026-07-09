"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useActionState } from "react";
import { signInFusionAdmin } from "@/app/fusionadmin/actions";

export function FusionAdminLoginForm() {
  const [state, formAction, isPending] = useActionState(signInFusionAdmin, { error: "" });

  return (
    <form action={formAction} className="login-card">
      <div className="login-icon">
        <LockKeyhole size={24} />
      </div>
      <p className="eyebrow">Fusion backend</p>
      <h1>Sign in to manage the platform.</h1>
      <label>
        <span>Email</span>
        <input autoComplete="email" name="email" placeholder="admin@fddynamics.com" type="email" />
      </label>
      <label>
        <span>Password</span>
        <input autoComplete="current-password" name="password" placeholder="Password" type="password" />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Signing in..." : "Enter backend"} <LogIn size={17} />
      </button>
    </form>
  );
}

