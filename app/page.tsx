export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "48px", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ maxWidth: 960, margin: "0 auto" }}>
        <p style={{ opacity: 0.65, marginBottom: 8 }}>ANAS OS · FOUNDATION</p>
        <h1 style={{ fontSize: 42, margin: 0 }}>Command Center</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, maxWidth: 720 }}>
          Private, modular, offline-first personal and professional operating system.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 32 }}>
          {[
            ["Tasks", "Core productivity"],
            ["Projects", "Work and personal projects"],
            ["Knowledge", "Searchable personal knowledge"],
            ["Documents", "Private document vault"],
            ["Culinary", "Professional culinary laboratory"],
            ["AI", "Permission-scoped assistant"],
          ].map(([title, description]) => (
            <article key={title} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20 }}>
              <strong>{title}</strong>
              <p style={{ opacity: 0.7, lineHeight: 1.4 }}>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
