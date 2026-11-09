"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { L } from "./strings";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null, email: "" });
  return (
    <form action={action} className="lg-form">
      <input type="hidden" name="next" value={next} />
      <label className="lg-field">
        <span>{L.email}</span>
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} key={state.email} />
      </label>
      <label className="lg-field">
        <span>{L.password}</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && (
        <p className="lg-error" role="alert">
          {L.wrong}
        </p>
      )}
      <button className="lg-submit" type="submit" disabled={pending}>
        {pending ? L.signingIn : L.signIn}
      </button>
    </form>
  );
}
