# ANAS OS Engineering Specification

## Architecture
ANAS OS is a private cloud-hosted, mobile-first PWA/web application using a modular-monolith architecture.

Primary stack:
- Next.js / React / TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Auth, PostgreSQL, Storage
- pgvector
- IndexedDB for offline data
- Zod validation
- Vitest + Playwright
- GitHub Actions

## Core modules
1. Command Center
2. AI Command Center
3. Personal OS
4. Family OS
5. Finance OS
6. Career OS
7. Culinary Lab
8. Learning OS
9. Project OS
10. Knowledge OS
11. Document Vault
12. Vehicle OS
13. Shared Workspaces
14. AI Agents
15. Automation
16. Integrations
17. Administration
18. AI Cost Center

## Security zones
- PRIVATE: owner only
- FAMILY: owner + explicitly selected family members
- PROFESSIONAL: owner + selected coworkers
- PROJECT: explicit workspace membership

Permission levels:
NONE, VIEW, COMMENT, CREATE, EDIT, DELETE, EXPORT, SHARE, ADMIN

Authorization decision:
USER + ROLE + WORKSPACE + RESOURCE + ACTION + CONTEXT

## Offline and sync
Required states:
ONLINE, OFFLINE, SYNCING, SYNCED, CONFLICT, ERROR

Sync uses operation queues and optimistic local writes. Conflicts are detected using versions. Supported resolution choices include Keep Server, Keep Mine, Merge, and Review. AI may suggest a merge but cannot silently decide meaningful conflicts.

## AI architecture
USER -> AI COMMAND -> INTENT CLASSIFIER -> PERMISSION ENGINE -> CONTEXT BUILDER -> DATABASE/RAG -> MODEL ROUTER -> TOOL ENGINE -> READ/WRITE -> APPROVAL WHEN REQUIRED -> AUDIT LOG

Agents are permission-scoped. AI tools operate through controlled APIs rather than unrestricted database access.

Sensitive actions include:
DELETE, SHARE, PERMISSION_CHANGE, FINANCIAL_WRITE, BULK_UPDATE, EXTERNAL_ACTION, PRODUCTION_CHANGE

Lifecycle:
PROPOSED -> AWAITING_APPROVAL -> APPROVED/REJECTED -> EXECUTE -> AUDIT

## Search
Search order:
1. exact database search
2. PostgreSQL full-text search
3. semantic/vector retrieval
4. AI synthesis

ANAS OS data is searched before external web sources when answering questions about the user's own information.

## Data domains
Core: users, profiles, workspaces, members, roles, permissions, tasks, projects, goals, notes, events, tags, attachments.

Documents: documents, document_versions.

Knowledge: knowledge_items, knowledge_sources, knowledge_links, embeddings.

AI: ai_conversations, ai_messages, ai_memories, ai_sources, ai_actions, ai_approvals, ai_usage.

Audit: audit_logs, security_events, sync_operations, devices.

Domain modules are planned for Culinary, Career, Learning, Finance, Family, and Vehicles.

## API boundary
All API requests follow:
Authentication -> user identification -> workspace membership -> resource authorization -> input validation -> business logic -> audit where required.

Zod validates external input. RLS is a database safety boundary and is not replaced by UI checks.

## AI cost controls
Track model, agent, feature, input/output/cached tokens, tool calls, web searches, and estimated cost. Apply per-agent and per-user budgets with warning thresholds and hard limits.

## Definition of Done
A feature requires appropriate:
- UI
- database model/migration
- API
- validation
- authentication
- authorization/RLS
- offline behavior
- sync behavior
- conflict handling
- auditability
- tests
- mobile and desktop behavior
- documentation

AI features additionally require tool permission checks, context controls, token budgets, cost tracking, provenance, approval handling, and failure handling.
