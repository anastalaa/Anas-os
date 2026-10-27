import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/api/auth";
import { getWorkspace, listMembers } from "@/lib/workspaces/service";

type RoleSummary = { name?: string | null };

function getRoleName(roles: unknown) {
  if (Array.isArray(roles)) {
    return (roles[0] as RoleSummary | undefined)?.name ?? null;
  }
  return (roles as RoleSummary | null | undefined)?.name ?? null;
}

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { supabase } = await requireAuthenticatedUser();
  const { workspaceId } = await params;
  const [workspace, members] = await Promise.all([
    getWorkspace(supabase, workspaceId),
    listMembers(supabase, workspaceId),
  ]);

  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/workspaces" style={{ color: "var(--muted)" }}>
          ← Workspaces
        </Link>
        <p style={{ color: "var(--accent)", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700, marginTop: 28 }}>
          {workspace.type}
        </p>
        <h1 style={{ fontSize: "clamp(2.2rem, 6vw, 4rem)", lineHeight: 1, margin: "16px 0" }}>
          {workspace.name}
        </h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          {workspace.description ?? "No workspace description."}
        </p>

        <section style={{ marginTop: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Members</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {members.map((member) => {
              const role = getRoleName(member.roles);
              return (
                <div key={member.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ overflowWrap: "anywhere" }}>{member.user_id}</span>
                  <span style={{ color: "var(--muted)" }}>{role ?? "UNKNOWN"} · {member.status}</span>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
