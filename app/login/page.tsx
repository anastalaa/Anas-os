import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: 28,
        }}
      >
        <p style={{ color: "var(--accent)", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700 }}>
          ANAS OS
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: 32 }}>Sign in</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>Loading secure sign-in…</p>
      </section>
    </main>
  );
}
