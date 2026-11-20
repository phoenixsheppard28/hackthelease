import Link from "next/link";
import styles from "./SignIn.module.scss";

export function SignIn({ error = false }: { error?: boolean }) {
  return <main className={styles.shell}>
    <header className={styles.header}><Link className={styles.brand} href="/">Homework</Link><span>Find your place together</span></header>
    <section className={styles.panel} aria-labelledby="auth-title"><div className={styles.content}>
      <p className={styles.eyebrow}>YOUR HOUSING SEARCH STARTS HERE</p>
      <h1 id="auth-title">Find your place together.</h1>
      <p className={styles.description}>Sign in with Google to continue your housing search.</p>
      <a className={styles.submit} href="/api/auth/google">Continue with Google <span aria-hidden="true">→</span></a>
      {error && <p className={styles.status} role="alert">Google sign-in did not finish. Please retry.</p>}
      <Link className={styles.preview} href="/listings-preview">Browse listings first <span aria-hidden="true">↗</span></Link>
    </div></section>
  </main>;
}
