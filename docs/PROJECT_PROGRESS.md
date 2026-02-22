# Project Progress

Last updated: 2026-02-18

Purpose:
This file is the single source of truth for plans, tasks, and progress tracking. It is meant to help resume work after context compaction or a new chat session, and to prevent duplicate work.

How to use:
- Add new tasks under the appropriate phase with a clear status.
- After each completed task, add a work log entry with the commit hash.
- Commit hashes are only known after commit. If needed, update the log in a follow-up "docs" commit.
- The work log tracks substantive task commits; pure log-maintenance commits do not need log entries.
- Keep "Current Focus" and "Next Actions" up to date.
- If you pause mid-task, note the current state and any open questions.

Context recovery checklist:
1) Read `AGENTS.md`.
2) Run `git status -sb`.
3) Run `git log -1 --oneline`.
4) Run `git diff` (and `git diff --stat` if needed).
5) Resume from the "Current Focus" or "Next Actions" section.

## Current Focus
- License key generator client flow fixed end-to-end: replaced hardcoded API URL logic with same-origin-first base resolution (`window.LICENSE_SERVER_BASE` / `?apiBase=` override), aligned frontend endpoints with existing backend legacy generate routes, improved error surfacing with endpoint details, and exposed generator over `GET /license-generator` for safe same-origin usage. Status: done.
- Added a production-focused Ubuntu cloud runbook (`docs/RUNBOOK_UBUNTU_CLOUD.md`) covering end-to-end setup for frontend/backend/license-server on VPS (Node/PostgreSQL/systemd/Nginx/SSL), integrity manifest signing flow, smoke tests, rollback, and a ready-to-use Codex prompt for server-side execution. Status: done.
- License-server admin zoom is now page-scoped: Ctrl/Cmd zoom (wheel and +/-/0) is captured inside admin UI and persisted per route path (`/admin/login`, `/admin`, `/admin/vendor-profile`) so zoom changes no longer leak across all admin pages. Status: done.
- Check-in flow updated per product direction: manual check-in is restored and fully usable, while only QR scanner mode now shows "Coming Soon" (toggle-controlled via `VITE_ENABLE_CHECKIN_QR`, with fallback support for legacy `VITE_ENABLE_CHECKIN`). Status: done.
- Persistent file-based error logging is now enabled for backend and license-server startup paths: errors/warnings/unhandled exceptions are mirrored to `data/logs/<service>-errors.log` (plus combined logs), and startup output now shows the exact error-log file path for quick support diagnostics. Status: done.
- Appointments page no longer depends on `/api/settings`: added secured `/api/appointments/meta` (requires `appointments.view`) to provide appointments-only trainers/services/config payload, switched appointments UI alert config loading to meta endpoint, and passed meta into appointment modal with fallback loading; settings endpoints remain protected under settings permissions. Status: done.
- Appointments permissions are now explicit and enforced end-to-end: split permission categories to include dedicated `Appointments` (view/manage) in permissions UI, enforce `appointments.view` for read endpoints and `appointments.manage` for mutating endpoints, and gate appointments actions in UI for view-only users while keeping friendly access-denied behavior. Status: done.
- Payments module now supports dedicated Package Payments flow: added `PACKAGE` type handling in `/api/payments`, new `/api/payments/export` structured Excel export, frontend tab (`مدفوعات الباقات`), package-aware table grouping/summary/search, and package payment coverage tests. Status: done.
- Targeted audit fixes applied and validated: shift report date filtering now uses overlap logic, employee collections now derives rows from closed shifts (including zero-activity shifts) with correct employee grouping key, cash close create now returns `warningCode=NEGATIVE_EXPECTED_CASH` when expected cash is negative, and POS shift history response now includes compatibility aliases (`endedAt`, `endedCash`, `createdAt`). Status: done.
- Full logic audit coverage added: stabilized date-sensitive appointment test + integrity probe-path tests, and introduced `backend/tests/logicAudit.test.js` to assert shift overlap filtering, employee collections grouping/basis, and negative expected-cash warning behavior. Current result: 4 targeted audit assertions fail and point to concrete logic inconsistencies that need product fixes. Status: done.
- Existing Member appointment flow corrected: removed status controls from the member tab, enforced member-required confirmed payload (bookingType=confirmed, default status=booked), added debounced member autocomplete with keyboard navigation and selection validation, and kept status controls only for tentative/preliminary flow. Status: done.
- Cash Close difference parser/label fixed: declared-vs-expected now uses robust money normalization (Arabic digits/separators, currency symbol stripping, comma/decimal handling), epsilon-zero balancing, and unit coverage for parse/diff logic. Status: done.
- Added export-demo dataset seeder and generated random realistic data for export QA (members, subscriptions, payments/refunds, sales, trainer earnings/payouts, cash movements, and closed cash-close periods) via `npm run seed:export-demo`. Status: done.
- License-server admin UI actions restored end-to-end: fixed login/dashboard/vendor scripts not triggering by switching to DOMContentLoaded bootstraps, replacing CSP-blocked inline button handlers with delegated events, adding explicit file:// warnings, and wiring `/api/admin/*` compatibility endpoints (login/logout/licenses/devices/reset/vendor-profile) to the dedicated license-admin auth routes. Status: done.
- Vendor Support Info delivered end-to-end: added `license-server`-only `vendor_profile` storage + admin APIs/UI (`/admin/vendor-profile`), public read endpoint (`/api/public/vendor-profile`, no license check), gym-app read-only Support page with cache/offline fallback, and expired-license access path (Support whitelisted + link on activation/expired screen). Status: done.
- Export refactor completed: replaced raw CSV/key-value report exports with structured styled Excel (`.xlsx`) across cash close and reports, added shared backend Excel service (`exceljs`), and wired remaining report exports (payments ledger, gym income sessions, pending completion, cash movements) to server-side Excel endpoints. Status: done.
- Cash Close end-to-end stability fixed: synced Prisma schema/client for `CashClosePeriod`, added explicit backend error codes + dev stack logging on create/current/history/list, hardened OPEN-period integrity checks, and updated frontend to show actionable cash-close toasts (no generic server-error masking). Status: done.
- Cash Close modal now computes `difference = declaredCash - expectedCash` in real-time with 2-decimal rounding, safe empty-input handling, and dynamic status badge (`عجز`/`زيادة`/`متوازن`) with red/green styling. Status: done.
- Post-login blank-screen loop fixed in frontend by preventing redundant auth-store user updates, decoupling POS init from `user` object changes, and hardening ErrorBoundary catch handling. Status: done.
- Device management architecture refactored: removed gym-app device admin UI/APIs, added dedicated license-server `/admin` dashboard and separate license-admin JWT auth (`LICENSE_ADMIN_JWT_SECRET`). Status: done.
- Recurring `INTEGRITY_MISMATCH` fixed with release-only signed manifest validation (versioned `/api/integrity/manifest`, RSA signature verification with embedded public key, production-only strict enforcement, and dev warn mode). Status: done.
- Post-licensing security layer implemented (device fingerprint binding, approved-device enforcement, RS256 activation tokens, 24h validation + 72h grace, integrity manifest verification, and baseline security tests/docs). Status: done, needs manual verification.
- Cash Close now uses POS-style periods (single OPEN period, immutable CLOSED snapshot, export CSV/JSON, auto-open new period, and close history tab in reports). Status: done, needs manual verification.
- Session Packs assign-member autocomplete now requires at least 2 letters, shows matching members, and writes the selected member name into the input on click. Status: done, needs manual verification.
- Trainer Report UI refreshed for cleaner readability (modern summary cards, clearer table header/value formatting, status badges in list/details) and Arabic labels restored for Trainer Report + Pending Completion. Status: done, needs manual verification.
- Trainer Report commissions integration build/parsing regression fixed in `TrainerReportPage.jsx` map closure. Status: done.
- Trainer Report now reads from unified `/api/commissions/summary` + `/api/commissions/transactions` APIs and settles via `/api/commissions/settle`. Status: done, needs manual verification.
- Close Cash financial preview no longer crashes and now returns stable `summary` payload with null-safe totals. Status: done, needs manual verification.
- Close Cash calculations now include cash movements (`IN`/`OUT`) and trainer payouts in expected cash/non-cash amounts. Status: done, needs manual verification.
- Close Cash modal/report UI now surfaces payouts total, cash-in total, adjusted expected cash formula, and expected card/transfer snapshot. Status: done, needs manual verification.
- Session ledger price section now uses `الفرق` (final - paid) and removes `المتبقي` from UI. Status: done, needs manual verification.
- Session ledger panel UI refactor (essential-only fields, cleaner hierarchy, simplified payments row with paid-by alignment). Status: done, needs manual verification.
- Gym Income - Sessions ledger drawer (eye action + detailed right-side ledger with payment timeline and adjustment history). Status: done, needs manual verification.
- Gym Income - Sessions report now uses dedicated backend endpoint so adjusted price details appear (original/final/diff/reason/adjusted-by). Status: done, needs manual verification.
- Tentative booking appointment flow (book tentative, complete with payment, convert to member, auto no-show after 3 days). Status: done, needs manual verification.
- Session Packs end-to-end flow (templates, assignments, attendance deduction, new page/nav). Status: done, needs manual verification.
- Session packages (plan type + member package assignment + check-in consumption + attendance endpoint + UI wiring). Status: done, needs manual verification.
- Quick payment in Assign Subscription flow, receipt fix, and reports refresh. Status: done, needs manual verification.
- Payments list cancelled badge. Status: done, needs manual verification.
- Record Payment modal embedded receipt + print. Status: done, needs manual verification.
- POS receipts and unified Receipts report UI. Status: done, needs manual verification.
- Fix Outstanding report paid totals/status and add payments summary transactions table. Status: done, needs manual verification.
- Record Payment success modal with receipt print/view and receipts fallback handling. Status: done, needs manual verification.
- Harden Record Payment submission with single-flight confirm + print button. Status: done, needs manual verification.

## Phase Plan

Phase 1 - Subscriptions quick payment and receipts
- Add Full/Partial payment mode in Assign Subscription modal. Status: done.
- Ensure payments are linked to subscriptions in backend. Status: done.
- Fix receipt flow to use authenticated frontend route. Status: done.
- Refresh Payments list and Reports summary after payment. Status: done.
- Add orphan payments audit script. Status: done.
- Add cancelled badge in Payments list rows when subscription status is cancelled. Status: done.
- Manual test checklist. Status: pending.

Phase 2 - Follow-ups (if needed)
- Address any issues from manual testing. Status: pending.
- Backfill or fix any orphan payments identified. Status: pending.

Phase 3 - Payments modal receipt embed
- Remove receipt navigation on confirm. Status: done.
- Render receipt preview inside modal with Print/Done actions. Status: done.
- Use settings currency formatting for receipt. Status: done.
- Manual test checklist for receipt. Status: pending.

Phase 4 - Receipts system
- Backend receipts storage and POS receipt creation. Status: done.
- Receipts report UI with sales/general tabs and export. Status: done.
- POS checkout success modal with receipt preview/print. Status: done.
- Manual test checklist for receipts. Status: pending.

## Work Log (Commit Ledger)

| Date       | Commit   | Summary |
|------------|----------|---------|
| 2026-02-22 | 6424c93  | Fix license key generator failures by removing brittle hardcoded API URL usage, adding same-origin/override API base resolution, switching generate calls to existing `/api/admin/legacy/*` endpoints, surfacing server error messages and resolved endpoint in UI, and serving the generator page from `GET /license-generator`. |
| 2026-02-22 | 83851a4  | Add `docs/RUNBOOK_UBUNTU_CLOUD.md` with full Ubuntu VPS deployment procedure (PostgreSQL, backend/license-server env setup, systemd services, Nginx + TLS, integrity manifest/signing workflow, smoke tests, troubleshooting, rollback, and Codex execution prompt). |
| 2026-02-18 | 4376239  | Scope license-server admin zoom per page by adding shared `zoom-scope.js` (Ctrl/Cmd + wheel/+/−/0 handling) and storing zoom by pathname so each admin page keeps its own zoom level. |
| 2026-02-18 | 427914a  | Restore full Check-in page access and scope "Coming Soon" to QR scanner mode only: remove full-page gate, keep manual entry + activity polling active, add QR-specific coming-soon messaging (AR/EN), and switch env toggle guidance to `VITE_ENABLE_CHECKIN_QR` with backward-compatible fallback. |
| 2026-02-18 | cc24781  | Temporarily disable Check-in UI with a Coming Soon gate controlled by `VITE_ENABLE_CHECKIN` (default off), prevent check-in data polling while gated, add AR/EN i18n messaging for the disabled state, and document the env toggle in `frontend/.env.example`. |
| 2026-02-18 | 661b33e  | Add persistent file logger utilities for backend and license-server, wire startup to initialize `data/logs` and mirror `console.error`/`console.warn` plus uncaught/unhandled failures to `<service>-errors.log`, and print active error-log path on boot for quick troubleshooting. |
| 2026-02-18 | f87cc29  | Decouple appointments from settings permission by adding `GET /api/appointments/meta` (guarded by `appointments.view`) for trainers/services/appointment-alert config, updating appointments page/modal to consume meta instead of `/api/settings`, and extending appointments permission tests for `/appointments/meta` allow/deny behavior. |
| 2026-02-18 | 7d6bf33  | Add missing Appointments permission module flow: backend appointments routes now require `appointments.view/manage` by operation type, permissions categories split into dedicated Appointments + Coaches sections for clearer toggles, appointments UI actions gated for view-only staff, and regression tests added for appointments permission middleware enforcement. |
| 2026-02-18 | 47d567c  | Add Package Payments support end-to-end: backend `/api/payments` now returns finalized package purchases (`type=PACKAGE`) from `MemberPackage`, add `/api/payments/export` structured Excel output, add Payments UI package tab/export wiring with package-specific accounting rows, and include backend route tests for package filtering behavior. |
| 2026-02-18 | 86a1872  | Apply targeted audit fixes: overlap-based POS shift range filtering, closed-shift-based employee collections with zero-shift visibility and corrected employee grouping key, cash-close negative expected-cash warning code in API response, and shift response compatibility aliases (`endedAt`, `endedCash`, `createdAt`). |
| 2026-02-18 | d164d92  | Add deterministic logic-audit backend tests for shift overlap filtering, employee collections consistency, and negative expected-cash warning behavior; stabilize flaky appointment/integrity tests (future-date booking payload and writable integrity probe path) so audit failures reflect real logic issues. |
| 2026-02-18 | c689628  | Fix Existing Member appointment flow by removing member-tab status editing, adding 300ms debounced member autocomplete (name/phone/member code + keyboard support), requiring member selection before confirm, and aligning create payload/backend defaults to confirmed member booking semantics while keeping tentative status logic isolated. |
| 2026-02-17 | 33c840d  | Fix Cash Close difference status/parsing by introducing shared `parseMoney`/diff helpers, switching declared cash inputs to locale-friendly text decimal mode, enforcing epsilon-balanced `متوازن` state on equal values, and adding frontend unit tests for Arabic numerals and cash-difference rules. |
| 2026-02-17 | 7555a22  | Add `backend` export-demo seeding command (`npm run seed:export-demo`) that atomically creates realistic random data for export validation across members/subscriptions/payments/refunds/sales/appointments/trainer earnings/cash movements and cash-close history snapshots. |
| 2026-02-17 | 74e6fed  | Fix license-server admin UI no-action regression: add robust admin UI script bootstraps/logging, block unsupported file:// usage with clear warnings, migrate API calls to `/api/admin/*` with sessionStorage token handling and 401 redirects, remove inline `onclick` handlers (CSP-safe delegated device actions), and add `/api/admin` route compatibility aliases for login/logout/device-list-by-key/reset-by-key while preserving legacy admin routes under `/api/admin/legacy`. |
| 2026-02-17 | e7c9f72  | Build Vendor Support Info feature: add `license-server` `vendor_profile` migration/model, public read API (`GET /api/public/vendor-profile`) with light rate limit, vendor admin profile page/APIs under separate license-admin auth, and gym-app read-only Support page (separate public HTTP client, local cache fallback, WhatsApp template vars, sidebar route, and expired-license whitelist/link). |
| 2026-02-17 | 12cb575  | Refactor export stack to structured styled `.xlsx`: add shared backend `exceljs` export service, convert cash close export to multi-sheet workbook (summary/payments/payouts/cash-in/sales), migrate reports/receipts/trainer exports to consistent Excel output, and replace remaining frontend CSV export actions with backend Excel downloads (payments ledger, gym income sessions, pending completion, cash movements). |
| 2026-02-17 | ff03374  | Fix Cash Close create/history/current failures end-to-end by enforcing Prisma cash-close model availability checks, returning endpoint-specific `errorCode` payloads with dev stack logs, preventing silent OPEN-period inconsistencies, adding regression tests for schema-mismatch handling, and updating frontend cash-close toasts for actionable errors. |
| 2026-02-17 | f7ce6f6  | Enhance Cash Close modal difference behavior with rounded real-time calculation (`declared - expected`), safe zero fallback for empty input, and dynamic Arabic status badge/color states for shortage/overage/balanced. |
| 2026-02-17 | 1b02134  | Fix post-login render crash loop by avoiding redundant `refreshSession` state writes, running POS initialization only on auth transition, and removing recursive ErrorBoundary catch-state updates. |
| 2026-02-17 | 2a67571  | Move device management out of gym client into license-server only: remove gym-side device routes/UI, add `/api/licenses/heartbeat`, add dedicated license-server `/admin` dashboard routes (`/admin/licenses`, `/admin/licenses/:id/devices`, approve/revoke/reset), and enforce separate license-admin JWT auth secret. |
| 2026-02-17 | 926a659  | Map integrity-related activation failures to HTTP 403 so tamper/signature/release-manifest blocks return explicit security status codes instead of generic 400. |
| 2026-02-17 | 31d329f  | Permanently fix recurring integrity mismatch by replacing source-file/token manifest checks with release-artifact SHA-256 manifests, RSA signature verification via embedded public key, versioned `/api/integrity/manifest` endpoint, production-only enforcement with dev warn mode, and updated integrity tests/docs. |
| 2026-02-17 | a6c3256  | Implement full post-licensing security layer: machine-id device fingerprint binding and approval workflow, RS256 activation token signing/verification, 24h revalidation with 72h offline grace, signed integrity manifest checks, audited device/license management endpoints, admin device dashboard page, and baseline security tests/docs. |
| 2026-02-17 | c0c492f  | Implement POS-style Cash Close periods with immutable snapshot close + CSV/JSON export, auto-open next period baseline, backend history/export endpoints, refreshed close modal/history UI, and period lifecycle tests. |
| 2026-02-17 | 4145293  | Fix Settings reset FK crash by deleting appointment-linked children (including `SessionPriceAdjustment`) before appointments and add regression test for reset order. |
| 2026-02-17 | 0aedc11  | Fix frontend quality command reliability by replacing missing-ESLint lint script with a working validation chain (`check:i18n` + production build). |
| 2026-02-17 | 1c5b89a  | Unblock Electron release build by removing missing icon references (fallback to default icon), add `electron/assets` build-resources directory, and align deployment docs to `prisma db push`. |
| 2026-02-17 | 6806687  | Harden license validation by removing recovery-key shortcuts and allowing offline bypass only with explicit development `LICENSE_BYPASS=true`. |
| 2026-02-17 | 8b83839  | Remove duplicate route declarations for `POST /api/payments/:id/refund` and `PUT /api/subscriptions/:id/toggle-pause` so each endpoint has a single canonical handler. |
| 2026-02-17 | 5dca48a  | Fix Assign Pack member autocomplete: enforce minimum search length, sync typed value with selected member, and auto-fill input text on member selection (with AR/EN hint key). |
| 2026-02-17 | 2de7db5  | Polish Trainer Report UI for simpler, clearer visuals (formatted headers/values and badges) and add missing Arabic keys for Trainer Report and Pending Completion labels. |
| 2026-02-17 | dacf5f3  | Fix Trainer Report frontend parse error by closing commissions transactions map expression in `TrainerReportPage.jsx`. |
| 2026-02-17 | 1f3f0ef  | Unify Trainer Report with commissions APIs (summary/transactions/settle), add canonical trainer commission transaction upsert in commission service, and add integration tests for transaction generation and settlement flow. |
| 2026-02-17 | f6f4e03  | Fix Close Cash financial preview crash, add null-safe summary response, include payouts/cash-in in expected calculations, persist new snapshot totals, and update close cash UI + tests. |
| 2026-02-17 | e08e9da  | Replace Session Ledger `remaining` with `difference` (final - paid), compute paid from completed/paid payment timeline rows, and add paid-in-full/overpaid states. |
| 2026-02-17 | 964414d  | Refactor Session Ledger drawer UI to essential information only, simplify pricing section, and streamline payment rows with cleaner paid-by alignment. |
| 2026-02-17 | 010ffc6  | Add Gym Income - Sessions ledger drawer UI with row action, backend ledger details endpoint, payment timeline, adjustment history, and AR/EN i18n keys. |
| 2026-02-17 | 10733a6  | Route Gym Income - Sessions report through `/reports/gym-income-sessions`, include adjustment details/phone in backend rows, and polish report formatting/export labels. |
| 2026-02-17 | a4ec6da  | Refactor appointments to tentative booking flow with direct appointment fullName/phone, hourly auto no-show scanner, and UI badges/actions updates. |
| 2026-02-17 | c645e15  | Add tentative lead booking flow with transactional completion/member conversion, lead-aware appointments UI, and route-level tests. |
| 2026-02-17 | 16c1215  | Add Book Appointment UI tabs for existing member vs first-time visitor with lead payload fallback in notes JSON. |
| 2026-02-17 | 9a029ca  | Harden login to normalize usernames, support safe admin password fallback, and trim frontend credentials. |
| 2026-01-24 | 4280c22  | Quick payment toggle, receipt route, reports refresh, payment validation, audit script. |
| 2026-01-24 | 2266548  | Add AGENTS.md and progress tracker docs. |
| 2026-01-24 | 10bfeaf  | Show cancelled badge in Payments list rows when subscription is cancelled. |
| 2026-01-24 | c4263b0  | Embed receipt preview in Record Payment modal with print support. |
| 2026-01-24 | 3e7185c  | Add full payment badge on receipt and label Print Receipt button. |
| 2026-01-24 | bc3532a  | Embed receipt preview and print inside Assign Subscription modal. |
| 2026-01-24 | 5fe6a6d  | Add print-last-receipt support in payment modals with latest receipt fetch. |
| 2026-01-24 | bffbc9f  | Always show Print Last Receipt in Assign Subscription modal step 3. |
| 2026-01-24 | 12889d5 | Disable report caching and normalize payments summary data. |
| 2026-01-24 | 6e19e9a | Fix Outstanding report data mapping and totals. |
| 2026-01-24 | ae54d41 | Show member name with phone in Outstanding report table. |
| 2026-01-24 | 13197e9 | Show member name in cancellations report. |
| 2026-01-24 | b5c1495 | Always show cancellation details under status. |
| 2026-01-25 | ced334e | Harden product create upload handling and surface save errors. |
| 2026-01-25 | 3da7718 | Allow setting product quantity on create/edit with stock adjustments. |
| 2026-01-25 | 3226010 | Allow direct quantity editing in POS cart views. |
| 2026-01-25 | 6df5c07 | Improve POS cart quantity input to allow typing values directly. |
| 2026-01-25 | 2f1789e | Add cash closing sales preview (product sales totals + top items). |
| 2026-01-25 | 9be4d44 | Align cash closing preview range to local time and guard date order. |
| 2026-01-25 | b160a85 | Add receipts storage, receipt service, and POS receipt generation backend. |
| 2026-01-25 | d47463b | Add POS receipt modal/print and unified receipts report UI. |
| 2026-01-25 | 0c813bf | Mark receipt reprints as COPY for POS and reports. |
| 2026-01-25 | 34c3a14 | Validate POS sale payload and send shift/cashier/paid fields. |
| 2026-01-25 | d3801fc | Add receipts schema guard with clear error message. |
| 2026-01-25 | f4a1fe4 | Export receipts via authenticated download. |
| 2026-01-25 | 1dd674d | Refresh settings from backend after save to prevent revert. |
| 2026-01-25 | 69f02b1 | Use saved gym name in sidebar branding. |
| 2026-01-25 | 68ca654 | Fix alerts settings save payload and parsing. |
| 2026-01-25 | 705b509 | Fix backup create db path resolution and error message. |
| 2026-01-25 | a3ca17c | Keep Record Payment modal on receipt view after confirm. |
| 2026-01-25 | 75d81c4 | Close Record Payment modal after success and guard double submit. |
| 2026-01-25 | 02b53af | Fix outstanding report paid totals and add payments summary transactions. |
| 2026-01-25 | 372dc8b | Add record payment success receipt actions and receipt fallback status. |
| 2026-01-25 | 00dd324 | Guard Record Payment confirm button, add single-flight + print-ready success view. |
| 2026-01-26 | 99a745b | Prevent partial payment auto-repeat in Record Payment modal. |
| 2026-01-26 | 22d2dcb | Prevent Record Payment modal from reinitializing after success. |
| 2026-01-26 | 5d80430 | Stabilize idempotency key per modal session to block repeat submits. |
| 2026-01-26 | 3d3313d | Enforce payment idempotency via transactionRef unique + backend dedupe. |
| 2026-01-26 | 3a570a3 | Prevent Record Payment reinit when parent refreshes while open. |
| 2026-01-31 | e84f6bc | Stabilize license endpoints and add license server root status. |
| 2026-02-01 | 9d39fc5 | Trainer commissions, appointments completion/alerts, and check-in enhancements. |
| 2026-02-01 | f1344b5 | Pending completion alerts/settings, trainer delete disabled, and i18n/check-in fixes. |
| 2026-02-01 | e08562d | Add trainer delete UI with hard-delete guard against linked data. |
| 2026-02-01 | d93e498 | Allow manual appointment completion at any time with early-complete confirmation. |
| 2026-02-01 | 9a629ed | Add trainer payouts with persistent earnings tracking and payout UI. |
| 2026-02-01 | 80a2f85 | Create pending payment invoice on appointment completion when balance remains. |
| 2026-02-01 | 4694b35 | Persist trainerId on appointment create/update so trainer earnings are recorded on completion. |
| 2026-02-01 | 9cad451 | Allow same-day past-time bookings, simplify appointment modal fields, and update time UI. |
| 2026-02-01 | 913c4f9 | Restore appointment modal details with trainer/coach selection, member info, and commission preview. |
| 2026-02-01 | 5953e1f | Fix coach dropdown selection in appointment modal by adding placeholder and controlled value. |
| 2026-02-01 | 5266951 | Restore reports overview layout and remove gym income/coach earnings pages from routes/navigation. |
| 2026-02-05 | 870aedf | Add member credit ledger, auto-apply overpayments to sessions, and expose credit in completion preview. |
| 2026-02-05 | 0cafb74 | Repair mojibake in Arabic/English i18n files to restore readable text. |

## Next Actions
- Run end-to-end licensing security smoke tests: first activation, blocked copied device, admin approve second device, revoked device/license blocking, offline grace expiry, and integrity mismatch.
- Ensure production secrets are configured on license server (`LICENSE_PRIVATE_KEY`, `LICENSE_PUBLIC_KEY`, `LICENSE_ADMIN_JWT_SECRET`) and rotate defaults before deployment.
- Regenerate and sign integrity manifests for each release build (`npm run build:integrity-manifest` then `cd license-server && npm run integrity:sign -- <appVersion>`).
- Run manual tests for full and partial subscription payments.
- Confirm receipt page opens without auth error.
- Confirm Payments Summary and Outstanding reports refresh correctly.
- Run receipt modal flow tests (no redirect, print works, currency matches settings).
- Run receipts migration and test POS receipt printing + receipts report tabs.
- Verify partial payment no-repeat behavior in Record Payment modal.
- Verify Record Payment modal stays on receipt after partial payment.
- Verify partial payments dedupe using stable idempotency key.
- Verify transactionRef idempotency prevents duplicate partial payments.
- Verify adjusted price details (original/final/diff/reason/adjusted-by) render in `Gym Income - Sessions` after appointment price adjustment.
- Verify Gym Income - Sessions `View Ledger` drawer opens from row action and shows session info, price breakdown, payment timeline, and adjustment history without horizontal table scrolling.
- Verify Session Ledger drawer visual cleanup: essential-only header fields, simplified price strip, and one-line payment row with `Paid By` aligned to far-left in RTL.
- Verify Session Ledger price section shows `الفرق` only (no `المتبقي`), with correct states for fully paid / due / overpaid.
- Verify Close Cash preview includes `payoutsTotal`, `cashInTotal`, and expected cash uses `cash revenue + cash in - payouts - cash refunds`.
- Verify creating trainer payout and cash movement (`OUT`/`IN`) changes expected cash/non-cash in Close Cash modal before saving.
- Run cash closing migration and validate new fields appear in close records (`expectedCardAmount`, `expectedTransferAmount`, `payoutsTotal`, `cashInTotal`).
- Run session package smoke test: create package plan, assign to member, verify check-in decrements remaining sessions.
- Verify `/api/attendance` shows session name/price history for package usage.

## Notes for new sessions
- If there are uncommitted changes, capture them in "Current Focus" and do not redo work.
- Use `git diff` to understand what already changed before coding.
| 2026-02-01 | 3bceee1 | Add trainer report in Reports with trainer earnings, payouts, filters, and payout actions. |
| 2026-02-01 | 2fb5e39 | Fix Arabic mojibake by restoring UTF-8 ar.json and add i18n encoding check script. |
| 2026-02-01 | f5c16b9 | Add gym income sessions report with filters, summary cards, and CSV export. |
| 2026-02-01 | 0f0d33f | Wire reports to live staff-trainer earnings and payments data; fix gym income Arabic labels. |
| 2026-02-01 | 4b298b6 | Fix Trainer Report crash by adding missing table subcomponents. |
| 2026-02-01 | 40320c5 | Add gym income sessions report filters/search using session payments; include member phone for search. |
| 2026-02-01 | 58ba4b3 | Restore gym income sessions report to use session payments endpoint and add dev logs for rows/totals. |
| 2026-02-02 | a0455f8 | Add pending completion report with filters, CSV export, and completion modal action. |
| 2026-02-02 | 8069e2f | Add Payments ledger tab inside Revenue report with filters, KPIs, and CSV export. |
| 2026-02-02 | 889727e | Fix Revenue report payments tab syntax error (StandardReportPage). |
| 2026-02-02 | 0e51ad0 | Fix Reports revenue tab guard and repair mojibake Arabic labels in reports UI. |
| 2026-02-02 | f066717 | Stabilize reports date ranges and filters; remove debug logs and prevent zeroed data on swapped ranges. |
| 2026-02-02 | b69695d | Harden pending completion report backend date parsing to avoid 500s on invalid ranges. |
| 2026-02-02 | 93e575c | Stabilize pending completion report nav label render, i18n key, and error toast guard. |
| 2026-02-02 | 8979f24 | Guard revenue report flag to prevent runtime ReferenceError and restore UTF-8 Arabic translations. |
| 2026-02-02 | b8d3a23 | Fix pending completion report Arabic strings and empty state messaging. |
| 2026-02-02 | c552fe7 | Stabilize pending completion report (frontend/backend), prevent console error, ensure API 200 + empty state. |
| 2026-02-02 | 5b3c190 | Restore trainer report table helpers and show pending completion rows when API returns data. |
| 2026-02-02 | 5fed571 | Allow Trainer Report custom table sections without invalid nesting errors. |
| 2026-02-02 | 4157a42 | Pending completion list now includes future/in-progress sessions (no end-time cutoff). |
| 2026-02-02 | 803fd3c | Fix i18n key leakage and stabilize attendance report. |
| 2026-02-02 | 5d1b20f | Fix ReportCard crash by defining translation hook. |
| 2026-02-02 | 5715573 | Fix reports page header translation keys and remove duplicate i18n entries. |
| 2026-02-02 | 18e5fb3 | Restore Arabic UTF-8 translations for reports and sidebar labels. |
| 2026-02-03 | 3859521 | Silence canceled request offline toasts and add missing report i18n keys. |
| 2026-02-03 | 2646b35 | Enforce unique member display name and phone with normalization and suggestions. |
| 2026-02-03 | e402859 | Return ok flag for member duplicate update responses. |
| 2026-02-03 | 039d940 | Return Arabic messages and ok flag for member duplicate conflicts. |
| 2026-02-03 | 1a4ba2d | Add member create debug errors and migration for normalized name/phone. |
| 2026-02-03 | 844fbb7 | Add post-create member next-step selection and navigation actions. |
| 2026-02-04 | 95c761a | Allow duplicate names; enforce member uniqueness by phone only. |
| 2026-02-04 | 8ec8698 | Hide remaining/refund fields in session payments UI. |
| 2026-02-04 | dc1e707 | Compute session commissions from global percent and store on payments. |
| 2026-02-04 | 759681d | Stabilize session completion (price validation, payment creation, pending visibility). |
| 2026-02-04 | 0228f2b | Fix mojibake Arabic strings in appointment completion modal and past-date validation. |
| 2026-02-04 | bacd539 | Make appointment completion idempotent and refresh pending list after completion. |
| 2026-02-04 | f4c687c | Enforce session price validation on completion and reuse pending payment on finalize. |
| 2026-02-04 | 0eb2fd2 | Harden appointment completion validation, pending payment creation, and coach earning. |
| 2026-02-04 | c18fcf4 | Add dev debug visibility for appointment completion errors. |
| 2026-02-04 | 35cd241 | Compute session commission from trainer percent with global fallback. |
| 2026-02-04 | 7c2e953 | Restore completion preview modal flow and enrich preview data. |
| 2026-02-04 | d72cea6 | Mark session payment as completed when collected and update appointment paid status. |
| 2026-02-04 | 8dc2105 | Allow editable commission percent in completion modal and persist trainer default. |
| 2026-02-04 | 103fe56 | Repair Arabic UTF-8 translations and default i18n language to Arabic. |
| 2026-02-04 | 46c778b | Force LTR table direction to stabilize report column order in RTL. |
| 2026-02-04 | 8d12a86 | Guard commission preview when appointment coach record is missing. |
| 2026-02-04 | 7fbdff7 | Persist trainer commission percent on completion and fix preview fallback. |
| 2026-02-04 | 3cb9bd2 | Use staff trainer for completion preview and fix coach label in modal. |
| 2026-02-04 | b2db339 | Fix settings reset delete order and date filters. |
| 2026-02-04 | 5cd4516 | Separate staff from trainer in appointments and payments display. |
| 2026-02-04 | 6a614f1 | Default Trainer Report to last 30 days and auto-select trainer; add empty-state i18n. |
| 2026-02-04 | bad48aa | Default Trainer Report to current month when dates are not provided. |
| 2026-02-04 | 8033026 | Force Trainer Report to default to current month unless user-set filters exist; add reset action. |
| 2026-02-04 | dca9c78 | Stabilize Trainer Report date defaults and ignore stale stored ranges outside current month. |
| 2026-02-04 | a068e39 | Enforce current-month defaults and refresh trigger for Trainer Report date filters. |
| 2026-02-04 | 8720e29 | Fix Trainer Report build error caused by invalid escape sequence. |
| 2026-02-05 | bfe911d | Backend only: add appointment final/due/overpaid fields, price adjustment audit, and adjust-price endpoint. |
| 2026-02-05 | 7b552cf | Frontend: add Adjust Price modal for completed appointments (calls adjust-price API). |
| 2026-02-05 | 7e8a2d6 | Price adjustment audit/history UI, guard settled sessions; effective commission fixes. |
| 2026-02-10 | 0ce58d6 | Harden completion preview query parsing and response fields. |
| 2026-02-10 | 91d5150 | Stabilize completion preview by validating params and guarding credit lookup. |
| 2026-02-10 | 51ed5ef | Fix completion update to avoid invalid Prisma fields on older DB. |
| 2026-02-10 | 879a059 | Surface preview completion errors in appointment modal. |
| 2026-02-10 | 89ecc01 | Make adjust-price endpoint schema-safe (no finalPrice select/update). |
| 2026-02-10 | 1d04825 | Finalize price adjustment audit with final-price reporting (trainer & gym income) and adjust-price preview labels. |
| 2026-02-10 | 8c59593 | Harden license activation errors, add format validation, and auto-clear corrupt cache. |
| 2026-02-10 | 6ee4ca8 | Prevent Prisma startup crash by forcing library engine + dotenv in backend. |
| 2026-02-10 | 60d08d5 | Restore Arabic translations in appointments (adjust price + completion modal labels). |
| 2026-02-10 | 339bf18 | Report adjustment fields now use SessionPriceAdjustment snapshots for original/final/diff. |
| 2026-02-10 | 912b6a6 | Add undo completion backend with permission guard, safety checks, and audit log. |
| 2026-02-10 | a037572 | Add undo completion UI with permission gate and reason modal. |
| 2026-02-10 | d6d4cc7 | Harden license activation error handling to avoid 500s on bad license server responses. |
| 2026-02-10 | 791b7c5 | Fix invalid en.json syntax causing Vite i18n import 500. |
| 2026-02-10 | 955a3f5 | Remove undo completion feature across UI, permissions, and backend routes. |
| 2026-02-10 | 7f2cf24 | Gym income sessions report now derives original/final/diff from appointment price/finalPrice with adjustment metadata. |
| 2026-02-16 | ff5da1e | Add session package schema models and migration. |
| 2026-02-16 | 2859b47 | Add package plan/member package endpoints and consume package sessions on check-in. |
| 2026-02-16 | 5ba50f9 | Ignore local runtime artifacts in git status. |
| 2026-02-16 | cc1749c | Add session package plans tab and i18n labels. |
| 2026-02-16 | 42d67b0 | Add package assignment flow to AssignPlanModal. |
| 2026-02-16 | 0ecaf0b | Add package CTAs and success messaging in Check-in. |
| 2026-02-16 | 0b87516 | Fix package selection JSX parse error. |
| 2026-02-16 | 558ebc5 | Add session package sales/consumption flow with package routes, migrations, idempotent check-in deduction, and UI wiring. |
| 2026-02-17 | f1a476e | Add Session Packs page/nav, pack-assignment APIs, payment fields, idempotent assignment check-ins, tests, and README usage section. |
| 2026-02-17 | 9ffa135 | Handle pack assignments schema-mismatch errors with explicit response instead of opaque 500. |
| 2026-02-17 | c82b8c0 | Auto-fill Assign Pack amount from template price and default missing amount_paid server-side. |
| 2026-02-17 | 90500ff | Switch backend defaults/config to PostgreSQL datasource and update setup commands. |
| 2026-02-17 | 96eb18e | Require gymName in license activation, add frontend validation/input, and return backend 400 for missing gymName. |
| 2026-02-17 | 7ec923b | Fix backend startup fallback URL to local Postgres default user to prevent API 500 when gym user lacks DB access. |
| 2026-02-17 | 9c0312a | Auto-bootstrap default admin user on first login when database has no users. |


