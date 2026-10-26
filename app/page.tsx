const modules = [
  ["Tasks", "Core productivity"],
  ["Projects", "Work and personal projects"],
  ["Knowledge", "Searchable personal knowledge"],
  ["Documents", "Private document vault"],
  ["Culinary", "Professional culinary laboratory"],
  ["AI", "Permission-scoped assistant"],
] as const;

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <p style={{ color: "var(--accent)", letterSpacing: "0.12em", fontSize: 12, fontWeight: 700 }}>
          ANAS OS · FOUNDATION
        </p>
        <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)", lineHeight: 1, margin: "16px 0" }}>
          Command Center
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1.6, maxWidth: 720 }}>
          A private, modular, offline-first operating system for personal life, family,
          career, culinary work, learning, projects, knowledge, documents, and AI.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 40 }}>
          {modules.map(([title, description]) => (
            <article key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 22 }}>
              <strong>{title}</strong>
              <p style={{ color: "var(--muted)", lineHeight: 1.5, marginBottom: 0 }}>{description}</p>
            </article>
          ))}
        </div>
        <footer style={{ marginTop: 48, color: "var(--muted)", fontSize: 13 }}>
          Foundation status: application shell → security → data layer → offline/sync → AI.
        </footer>
      </section>
    </main>
  );
}
