import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";

export default async function DashboardPage() {
  if (!hasSupabaseConfig()) {
    return <ConfigurationRequired />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ConfigurationRequired />;
  }

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ color: "var(--accent)", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700 }}>
          ANAS OS · PRIVATE
        </p>
        <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)", lineHeight: 1, margin: "16px 0" }}>
          Command Center
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Authenticated as {user.email ?? "your account"}. Core workspace modules are being built behind this boundary.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 32 }}>
          {[
            ["Tasks", "Permission-scoped task management"],
            ["Projects", "Project workspaces and milestones"],
            ["Notes", "Private structured knowledge capture"],
            ["Documents", "Protected document metadata and versions"],
            ["AI", "Approval-aware assistant foundation"],
            ["Sync", "Offline-first synchronization foundation"],
          ].map(([title, description]) => (
            <article key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
              <strong>{title}</strong>
              <p style={{ color: "var(--muted)", lineHeight: 1.5, marginBottom: 0 }}>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ConfigurationRequired() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ maxWidth: 560, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 28 }}>
        <h1>Authentication configuration required</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Configure the Supabase environment variables before using the private command center.
        </p>
      </section>
    </main>
  );
}
