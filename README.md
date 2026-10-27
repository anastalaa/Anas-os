# ANAS OS

Private, modular, offline-first personal and professional operating system.

## Principles
- User-owned data
- Security before convenience
- Explicit permissions and least privilege
- Offline-first operation with conflict-aware synchronization
- AI constrained by authorization and provenance
- Deterministic business logic implemented in code
- No silent destructive actions
- Modular monolith before microservices

## Initial stack
- Next.js + React + TypeScript
- Supabase Auth/Postgres/Storage
- PostgreSQL full-text search + pgvector
- IndexedDB offline layer
- Zod validation
- Vitest + Playwright
- GitHub Actions

## Foundation status
The `codex/core-foundation` branch now contains the executable application shell, validated environment boundary, Supabase client boundaries, core PostgreSQL/RLS migration, and CI validation workflow.

Production credentials and production database changes are intentionally not included in source control.

## Security warning
This repository is currently public. Do not commit personal, family, financial, authentication, production, or other private ANAS OS data. The repository should be switched to private before real personal data or production configuration is introduced.

## Documentation
- `ANAS_OS_CONSTITUTION.md`
- `ANAS_OS_ENGINEERING.md`
- `supabase/migrations/0001_core_foundation.sql`
- `docs/architecture/`
- `docs/security/`
- `docs/ai/`
