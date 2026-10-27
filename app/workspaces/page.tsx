import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/api/auth";
import { listWorkspaces } from "@/lib/workspaces/service";

export default async function WorkspacesPage() {
  const { supabase } = await requireAuthenticatedUser();
  const workspaces = await listWorkspaces(supabase);

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ color: "var(--muted)" }}>
          ← Command Center
        </Link>
        <p style={{ color: "var(--accent)", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700, marginTop: 28 }}>
          ANAS OS · WORKSPACES
        </p>
        <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)", lineHeight: 1, margin: "16px 0" }}>
          Workspace Engine
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Access is filtered by authenticated membership and workspace permissions at the database boundary.
        </p>

        {workspaces.length === 0 ? (
          <article style={{ marginTop: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
            <strong>No workspaces yet.</strong>
            <p style={{ color: "var(--muted)" }}>Create the first workspace through the workspace API.</p>
          </article>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 32 }}>
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/workspaces/${workspace.id}`}
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}
              >
                <strong>{workspace.name}</strong>
                <p style={{ color: "var(--muted)", marginBottom: 8 }}>{workspace.type}</p>
                <small style={{ color: "var(--muted)" }}>{workspace.slug}</small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
