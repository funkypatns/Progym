# Project Progress

Last updated: 2026-02-02

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

## Next Actions
- Run manual tests for full and partial subscription payments.
- Confirm receipt page opens without auth error.
- Confirm Payments Summary and Outstanding reports refresh correctly.
- Run receipt modal flow tests (no redirect, print works, currency matches settings).
- Run receipts migration and test POS receipt printing + receipts report tabs.
- Verify partial payment no-repeat behavior in Record Payment modal.
- Verify Record Payment modal stays on receipt after partial payment.
- Verify partial payments dedupe using stable idempotency key.
 - Verify transactionRef idempotency prevents duplicate partial payments.

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
