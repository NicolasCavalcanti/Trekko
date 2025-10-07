# TreKKo Home Page Functional Specification

## Overview

This document translates the high-level requirements for the TreKKo home page into an actionable specification for the product, design, and engineering teams. It emphasizes the discovery-first experience, parity with the BD_CADASTUR data model, and alignment with TreKKo's authentication and observability standards.

## 1. Objectives

- Deliver a visually engaging landing page inspired by the Airbnb experience.
- Surface real trail, park, and expedition data without mocks.
- Enable geospatial discovery with seamless transitions between list and map layouts.
- Support guide activation flows that rely on the BD_CADASTUR registry.
- Maintain high standards for performance, accessibility, SEO, and observability.

## 2. Layout and Information Architecture

### 2.1 Header

- **Logo:** TreKKo brand palette — forest green `#2D6A4F`, earth brown `#7C4B2A`, petroleum blue `#1E3A5F`, beige `#E7D9C0`, graphite `#333333`.
- **Primary search pill:**
  - Placeholder text: "Buscar por trilha, parque, cidade ou estado".
  - Autocomplete suggestions driven by `trails`, `parks`, `cities`, and `states` datasets.
  - Search icon button triggers submission.
- **Right-hand actions:**
  - Favorites (visible for authenticated users only).
  - Help/FAQ entry point.
  - User menu with contextual options (Enter, Profile, My reservations, Sign out).
- **Responsive behavior:**
  - Shrink header and compact search on scroll.
  - On mobile, center the search pill with a floating search button for accessibility.

### 2.2 Category Scroller

- Horizontal scroll of quick filters with pictographic icons.
- Initial categories: Montanha, Cachoeira, Parques Nacionais, Pet-friendly, Multi-day, Trilhas curtas, Trilhas com camping.
- Each tap applies the corresponding filter via the search module.

### 2.3 Trail & Expedition Grid

- Responsive grid: 4 columns desktop, 2 tablet, 1 mobile.
- Card content requirements:
  - Cover image with hover carousel on desktop and swipe gesture support on mobile.
  - Trail name and park/region metadata.
  - City and UF.
  - Difficulty, distance, elevation gain.
  - Expedition price (if applicable).
  - Average rating (star icon + review count).
  - Badges for Pet-friendly, Guia obrigatório, Camping permitido.

### 2.4 Map Toggle

- "Ver no mapa" button transforms the layout into a 50/50 split: list on the left, map on the right.
- Map interactivity requirements:
  - Pins represent trails/expeditions filtered in the current view.
  - Selecting a pin scrolls/highlights the associated card.
  - Selecting a card focuses the relevant pin.

### 2.5 How It Works

- Three illustrated steps: Find trail, Reserve with CADASTUR-certified guides, Experience safely & sustainably.

### 2.6 Trending Destinations

- Carousel showcasing the most searched states/regions.
- For each destination:
  - Display name.
  - Real-time count of available trails.
  - Hero image sourced from the first trail in that locale.

### 2.7 Footer

- Links: About, Contact, Privacy Policy, Terms of Use.
- Social media icons and future "Download App" button placeholder.
- Language selector: pt-BR (default), en-US.

## 3. Data & Integrations

### 3.1 BD_CADASTUR

- Source of truth for registered guides.
- Required fields: `cadastur_numero`, `nome_completo`, `uf`, `municipio`, `contato_email`, `whatsapp`, `instagram`, `foto_url`, `status_cadastur`.
- Updated through admin panel CSV uploads with staging-to-prod sync.

### 3.2 Platform Tables

- `users`: manages authentication and user types (`trekker`, `guia`).
- `guides`: maps users to BD_CADASTUR entries and tracks activation status.
- `trails`, `expeditions`, `reviews`: feed homepage content and search results.

### 3.3 Search Service

- Primary search queries trails, parks, cities, states via indexed views.
- Supports filters for category, difficulty, distance, elevation gain, water points, camping, pet-friendly, and guide requirement.
- Sorting options: relevance (default), rating, distance, lowest price.

## 4. Authentication & Guide Activation

- Supported login: magic link (preferred), Google OAuth, Apple OAuth.
- Sessions: HTTP-only cookies, CSRF protection, rate limiting, Turnstile CAPTCHA, 24h inactivity timeout.
- Guide activation flow:
  1. Logged-in user with `tipo_usuario != 'guia'` sees "Ativar cadastro de guia CADASTUR".
  2. Form captures CADASTUR number, pre-filled editable name, UF, Municipality.
  3. Backend validates entry against BD_CADASTUR (case-insensitive, accent-insensitive match).
  4. On success: create/update `guides` with `status_platform = 'pending'`, notify admin.
  5. On failure: display contextual error messages and log attempts.
  6. Admin review sets status to `active` and upgrades `users.tipo_usuario`.

## 5. Performance, SEO, and Accessibility

- Stack: Next.js App Router with SSR and ISR.
- Optimize via CDN, image lazy-loading, schema.org metadata, OG tags, sitemap, robots.txt.
- Core Web Vitals targets: LCP < 2.5s, CLS < 0.1, INP < 200ms.
- Accessibility: ARIA semantics, AA contrast, keyboard navigation.
- i18n default pt-BR with optional en-US locale.

## 6. Observability & Analytics

- Events: `search_submitted`, `filter_applied`, `card_clicked`, `map_opened`, `guide_activation_opened`, `guide_activation_success`, `guide_activation_fail`.
- Alert if guide activation failure rate exceeds 3%.
- Audit logs capture IP, user agent, timestamps, and outcomes for activation attempts.

## 7. Admin Panel Requirements

- CSV upload workflow for BD_CADASTUR with diff preview and rollback support.
- Manage guide activation (approve, reject, edit) with audit trails.
- Sync changes to production database without downtime.

## 8. System Messages

| Type | Message |
| --- | --- |
| Success | "Solicitação de ativação recebida. Validaremos seus dados CADASTUR em breve." |
| Divergence | "Os dados informados divergem do registro na BD_CADASTUR." |
| Error | "Cadastro não encontrado. Verifique seu número CADASTUR." |
| Info | "A BD_CADASTUR é atualizada periodicamente. Você pode solicitar atualização se seu nome ainda não aparecer." |

## 9. Acceptance Criteria

- Homepage displays live trail data.
- Search returns relevant results for trails, parks, cities, and states.
- Map toggle keeps cards and pins in sync.
- No "Vire guia" CTA anywhere in the product.
- Guide activation only succeeds for existing BD_CADASTUR entries.
- Activation attempts produce audit logs.
- Admin panel updates BD_CADASTUR without service disruption.
- Lighthouse desktop scores ≥ 90 for SEO and Accessibility.

