# ANAS OS Engineering Constitution

## 1. Data Ownership
ANAS OS data belongs to its owner. The system must preserve exportability and avoid vendor lock-in.

## 2. Security First
Authentication, authorization, row-level security, auditability, least privilege, and secure secret handling are mandatory foundations.

## 3. AI Cannot Bypass Authorization
Every AI read/write/tool call is evaluated against the same authorization boundary as a human request. AI never receives unrestricted database access.

## 4. Deterministic Logic Uses Code
Calculations, permissions, synchronization, costing, financial arithmetic, validation, and other deterministic operations must be implemented deterministically. AI may explain or recommend but must not replace reliable computation.

## 5. Original Data Is Authoritative
Source documents, user-entered records, and validated structured data remain authoritative. AI summaries, classifications, inferences, and recommendations are separate and traceable.

## 6. No Silent Destructive Actions
Delete, share, permission changes, bulk updates, financial writes, external actions, and production changes require explicit approval where designated by policy.

## 7. Offline Is First-Class
Core workflows must work offline where specified. Synchronization must be conflict-aware and must never blindly overwrite meaningful user changes.

## 8. Provenance
AI-derived information must preserve its source chain where applicable: SOURCE -> FACT -> AI INFERENCE -> RECOMMENDATION -> USER DECISION.

## 9. Auditability
Sensitive operations and AI actions must be auditable.

## 10. Modular Architecture
Start as a modular monolith. Do not introduce microservices without an explicit architectural decision supported by a demonstrated need.

## 11. Testing Is Part of Completion
A feature is not complete until its functional, permission, offline/sync, security, and relevant AI behavior has appropriate automated coverage.

## 12. No Architectural Drift
Implementation agents must follow the approved specifications. If a conflict or architectural gap is discovered, document it and resolve it deliberately rather than silently changing the system's principles.
