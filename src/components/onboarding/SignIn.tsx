"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "./SignIn.module.scss";

export function SignIn() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus("");

    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) setStatus(result.error || "Please retry.");
      else window.location.href = "/groups";
    } catch {
      setStatus("Could not connect. Please retry.");
    } finally {
      setPending(false);
    }
  }

  const isCreating = mode === "sign-up";

  return <main className={styles.shell}>
    <header className={styles.header}><Link className={styles.brand} href="/">Hack the Lease</Link><span>Find your place together</span></header>
    <section className={styles.panel} aria-labelledby="auth-title"><div className={styles.content}>
      <p className={styles.eyebrow}>YOUR HOUSING SEARCH STARTS HERE</p>
      <h1 id="auth-title">{isCreating ? "Create your account." : "Welcome back."}</h1>
      <p className={styles.description}>{isCreating ? "Make an account to search with your housing group." : "Sign in to continue your housing search with your group."}</p>
      <form onSubmit={submit}>
        <label htmlFor="student-email">Email address</label>
        <input id="student-email" type="email" autoComplete="email" placeholder="you@school.edu" required value={email} onChange={event => setEmail(event.target.value)} />
        <label htmlFor="student-password">Password</label>
        <input id="student-password" type="password" autoComplete={isCreating ? "new-password" : "current-password"} minLength={isCreating ? 8 : undefined} maxLength={isCreating ? 72 : undefined} required value={password} onChange={event => setPassword(event.target.value)} />
        {isCreating && <p className={styles.hint}>Use at least 8 characters.</p>}
        <button className={styles.submit} type="submit" disabled={pending}>{pending ? "Please wait…" : isCreating ? "Create account" : "Sign in"} <span aria-hidden="true">→</span></button>
      </form>
      {status && <p className={styles.status} role="alert">{status}</p>}
      <p className={styles.switch}>{isCreating ? "Already have an account?" : "New to Hack the Lease?"} <button type="button" onClick={() => { setMode(isCreating ? "sign-in" : "sign-up"); setStatus(""); }}>{isCreating ? "Sign in" : "Create an account"}</button></p>
      <Link className={styles.preview} href="/listings-preview">Browse listings first <span aria-hidden="true">↗</span></Link>
    </div></section>
  </main>;
}
