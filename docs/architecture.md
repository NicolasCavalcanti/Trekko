# TreKKo Platform Architecture Plan

## 1. Product Overview
TreKKo is a marketplace for booking guided trail experiences in Brazil. The platform aggregates authoritative CADASTUR guide data, community-enriched guide profiles, curated trail content, and expedition bookings into a single experience. Core flows include:

- Discoverability via an Airbnb-like home page with quick search, featured content, and map toggle.
- Dedicated guide and trail search pages offering multi-dimensional filtering, ranking, and pagination powered by CADASTUR and internal data.
- User accounts with authentication, profile management, and guide activation gated by CADASTUR validation and admin review.
- Expedition detail pages with availability, pricing, and review information.
- Administrative tooling to ingest/version CADASTUR datasets and approve guide activations.

The solution prioritizes performance (SSR/ISR, Core Web Vitals), accessibility (WCAG AA), SEO (structured data), and observability (metrics, tracing, analytics events).

## 2. Technology Stack
- **Frontend:** Next.js (App Router) with TypeScript, React Server Components, Tailwind CSS or styled-system for design tokens, next/image for optimized media, Mapbox GL JS for map toggle, React Query/Server Actions for data fetching.
- **Backend:** Next.js API Routes/Server Actions backed by Prisma ORM.
- **Database:** PostgreSQL with extensions `pg_trgm` for fuzzy search and `postgis` (optional) for spatial filtering.
- **Authentication:** Auth.js (NextAuth) using Magic Link and OAuth (Google, Apple, Microsoft). Session cookies are HTTP-only, Secure, SameSite=Lax, complemented with CSRF tokens and rate limiting.
- **Caching & Delivery:** Vercel/Next.js ISR with CDN caching, Redis (or Upstash) for session throttling and saved searches.
- **Observability:** OpenTelemetry traces, Vercel Analytics, Logflare, and custom events stored in PostHog or Segment.

## 3. Data Model
### 3.1 Core Tables
- **users** `(id, email, name, avatar_url, locale, tipo_usuario enum[cliente|guia|admin], created_at)`
- **user_sessions** `(id, user_id, provider, expires_at, metadata)`
- **guides_cadastur** `(cadastur_numero PK, nome, uf, municipio, contato_email, whatsapp, instagram, foto_url, status_cadastur, updated_hash, ingested_at, version_id FK)`
- **guide_profiles** `(id, user_id FK, cadastur_numero FK, bio, idiomas text[], categorias text[], preco_base, agenda jsonb, status_platform enum[pending|active|rejected], rating_media, reviews_count)`
- **trails** `(id, nome, parque_regiao, cidade, uf, nivel enum[facil|medio|dificil], distancia_km, ganho_m, guia_obrigatorio, entrada_paga, preco_entrada, agua, camping, estacionamento, preco_estacionamento, aeroporto_prox, rodoviaria_prox, geo_lat, geo_lng, popularidade, created_at)`
- **trail_reviews** `(id, trail_id FK, user_id FK, rating, comment, created_at)`
- **expeditions** `(id, trail_id FK, guide_profile_id FK, titulo, descricao, preco, capacidade, datas jsonb, created_at)`
- **bookings** `(id, expedition_id FK, user_id FK, status, total_price, pax_adults, pax_children, check_in, check_out)`
- **cadastur_versions** `(id, file_name, checksum, processed_by, processed_at, diff_summary jsonb, rolled_back boolean)`
- **guide_activation_requests** `(id, user_id FK, cadastur_numero, nome, uf, municipio, status enum[pending|approved|rejected], reviewer_id FK, reviewed_at, notes)`
- **saved_searches** `(id, user_id FK, type enum[guides|trails], filters jsonb, created_at)`
- **analytics_events** `(id, user_id FK null, event_name, payload jsonb, occurred_at)`

### 3.2 Indexing Strategy
- `guides_cadastur`: BTREE `(uf, municipio)`, BTREE `cadastur_numero`, GIN trigram on `nome` and `municipio`.
- `guide_profiles`: BTREE `status_platform`, `user_id`; partial indexes for active guides.
- `trails`: BTREE `(uf, cidade, nivel)`, GIN trigram on `nome`, `parque_regiao`, `cidade`, GiST on `geography(Point,4326)` when map radius search is enabled.
- `expeditions`: BTREE `(guide_profile_id, trail_id)`.
- Materialized view `guides_search_view` merging CADASTUR and platform data for fast filtering.
- Materialized view `trails_search_view` containing derived metrics (distance buckets, normalized popularity).

## 4. API Design
### 4.1 Guide Search `/api/guides/search`
- **Query Params:** `uf, municipio, nome, cadastur, categorias[], idiomas[], precoMin, precoMax, ratingMin, disponInicio, disponFim, acessibilidade, petFriendly, page=1, size=30, sort`.
- **Sort Options:** `relevancia`, `melhor_avaliado`, `mais_experiente`, `menor_preco`, `mais_proximo`.
- **Response:** `{ data: GuideCard[], pagination: { page, size, total, totalPages }, facets }` with `GuideCard` containing enriched fields (photo, categorias, preco, rating, agenda snippet).
- **Implementation:** Prisma query builder hitting `guides_search_view` with trigram matching, optional geospatial distance calculation if user location provided.

### 4.2 Trail Search `/api/trails/search`
- **Query Params:** `nome, parque, cidade, uf, nivel, distMin, distMax, ganhoMin, ganhoMax, agua, camping, guiaObrig, entradaPaga, precoEntradaMax, estacionamento, precoEstMax, page=1, size=30, sort`.
- **Sort Options:** `relevancia`, `melhor_avaliada`, `menor_distancia`, `menor_ganho`, `mais_proxima`.
- **Response:** Similar pagination envelope with `TrailCard` entries containing metadata, badges, coordinates (for map pins).
- **Implementation:** SQL view with computed `relevancia` scoring (text similarity + popularity). Use `ILIKE`/`trigram_similarity` for fuzzy matching.

### 4.3 Guide Activation `/api/guides/activate`
- Validates payload against `guides_cadastur`. On success creates/updates `guide_profiles` and inserts a `guide_activation_request` with `status=pending`. Emits analytics event `activation_requested`.

### 4.4 Admin CADASTUR Sync `/api/admin/cadastur/upload`
- Accepts CSV upload, validates schema (column presence, types), stores file, computes checksum. Parses CSV streaming into staging table `guides_cadastur_staging`. Generates diff summary (new/updated/deactivated). Requires admin auth and CSRF token.
- Transactionally syncs staging → production tables with version row. Supports rollback via `/api/admin/cadastur/rollback/:version`.

### 4.5 Admin Activation Review `/api/admin/activations`
- List, approve, reject activation requests. On approval sets `guide_profiles.status_platform='active'` and updates `users.tipo_usuario='guia'`. Rejection stores notes and triggers notification.

## 5. Frontend Architecture
### 5.1 Routing (App Router)
- `/` Home with SSR search hero, categories carousel, featured trails, toggleable map (client component) and localized copy via `next-intl`.
- `/guides` Guides search page. Server component fetches filter metadata (UF list, categories, idiomas). Client subcomponents handle filter state, virtualization of results, map synchronization.
- `/trails` Trails search page mirroring guide search, with advanced filters collapsed by default.
- `/trails/[id]` Trail detail page with SSR for metadata, dynamic segments for expeditions, reviews, map.
- `/expeditions/[id]` Booking flow, guard by authentication.
- `/profile` User dashboard with tab for guide activation if CADASTUR match.
- `/admin/cadastur` CSV ingestion dashboard (protected route) with upload wizard, diff preview, version history.
- `/admin/guides` Activation review queue.

### 5.2 Shared UI Elements
- Sticky filter header component with accessible keyboard navigation, ARIA attributes, and responsive layout.
- Search cards using skeleton loaders and responsive grid.
- Map toggle component using dynamic import and virtualization to sync list scroll with map markers.
- `SavedSearchButton` integrated with local storage for quick retrieval.

### 5.3 State Management
- Server Actions for initial SSR data hydration; React Query or SWR for client revalidation.
- URLSearchParams synchronized with filter state for sharable URLs and SSR caching.
- Debounced fuzzy search inputs (nome, município) hitting autocomplete endpoints.

## 6. Authentication & Authorization
- Auth.js providers: Email Magic Link (default), Google, Apple, Microsoft. Implement passkey-ready architecture by storing WebAuthn credential metadata.
- Middleware enforcing auth on protected routes, redirecting to `/login` when necessary.
- Role-based authorization (customer, guide, admin) enforced via server actions and `withRole` helper.
- CSRF protection via anti-forgery tokens in form submissions (guide activation, admin upload).
- Rate limiting login/activation endpoints using Redis-based limiter.

## 7. Guide Activation Flow
1. Logged-in user opens `/profile`. If no active guide profile, shows “Ative seu cadastro de guia” form.
2. User submits CADASTUR number, name, UF, município. Backend normalizes strings (accent removal, uppercase) and searches `guides_cadastur`.
3. When match found, create or update `guide_profiles` with `status_platform='pending'`, link to user.
4. Insert activation request into queue and notify admins (email/Slack). Show confirmation to user with expected SLA.
5. Admin reviews request with context (CADASTUR entry, historical expeditions). Approve → update statuses, emit `activation_approved` event and send email. Reject → `activation_denied` with notes.

## 8. CADASTUR Ingestion Pipeline
1. Admin uploads CSV via protected UI. Backend validates header & data types, writes to S3/local storage, logs metadata.
2. Stream rows into staging table; compute row hash for change detection.
3. Generate diff summary: counts of new guides, updated fields, removed entries. Present to admin for confirmation.
4. On confirm, transactionally upsert into `guides_cadastur`, marking removed entries as `status_cadastur='inactive'`.
5. Store version record referencing checksum and diff summary. Emit observability metrics (rows processed, duration, errors).
6. Provide rollback by restoring from previous version using stored diff or snapshot.

## 9. Search Experience & Ranking
- **Relevância Score (Guides):** Weighted combination of trigram similarity (nome, município) and proximity (haversine distance to search location or user location), boosted by guide platform status and rating.
- **Relevância Score (Trails):** Weighted trigram similarity (nome/parque/cidade) + normalized popularity + review rating boost.
- Implement fallback sorting (alphabetical) when filters remove scoring context.
- Provide telemetry events `guides_filter_applied`, `trails_filter_applied` with payload of filters and results count.

## 10. Performance, SEO, and Accessibility
- Use Next.js ISR for search result pages with filter-aware caching and revalidation on data changes.
- Optimize Core Web Vitals: skeleton loading, prefetch on hover, prioritized `next/image` placeholders, CSS containment for map toggle.
- Generate structured data: `TouristTrip` for trails, `LocalBusiness` for guides, using SSR metadata.
- Ensure accessible forms: label association, `aria-expanded`, `aria-controls`, keyboard focus states, color contrast AA.
- Provide i18n using `next-intl`, defaulting to pt-BR with en-US fallback, storing translations for static copy and dynamic content.

## 11. Observability & Metrics
- Instrument API routes with OpenTelemetry traces capturing DB timing, cache hits/misses.
- Log search latency, result counts, errors. Emit custom events defined in requirements to analytics warehouse.
- Dashboard KPIs: search conversion rate, activation approval SLA, CADASTUR ingestion health.
- Integrate error monitoring (Sentry) with release tags.

## 12. Deployment & DevOps
- Infrastructure via Vercel (frontend/backend) + managed PostgreSQL (Supabase/Neon) + Redis (Upstash).
- CI/CD: GitHub Actions running lint, type-check, unit/integration tests, Lighthouse CI for key pages, schema migrations via Prisma Migrate.
- Feature flags for map toggle, advanced filters, review surfaces using LaunchDarkly or simple DB toggles.
- Backup strategy: daily snapshots of Postgres and CADASTUR CSV artifacts.

## 13. Implementation Roadmap (High-Level)
1. **Foundation:** Bootstrap Next.js app, configure Auth.js, Prisma schema, migrations, base UI kit.
2. **Data Layer:** Ingest initial CADASTUR CSV, seed trails table, implement search views and indexes.
3. **Guide Search Page:** Build filters, list, pagination, map toggle, API integration.
4. **Trail Search Page:** Implement filters, cards, map toggle, ranking logic.
5. **Home Page:** Search hero, categories, featured content, map toggle integration.
6. **Guide Activation Flow:** Profile UI, backend validation, admin queue, notifications.
7. **Admin Tools:** CADASTUR ingestion UI, activation management.
8. **Performance & Observability:** Optimize vitals, add telemetry, finalize SEO & accessibility audits.

## 14. Open Questions
- Confirm pricing model and commission handling for bookings.
- Determine data source for expedition availability (manual entry vs integration).
- Decide on map provider licensing (Mapbox vs Google Maps) and offline fallback.
- Clarify requirement for saved searches notifications (email/push) cadence.
- Define SLA for admin approvals and user messaging for delays.

