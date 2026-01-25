# Project Progress

Last updated: 2026-01-25

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

## Next Actions
- Run manual tests for full and partial subscription payments.
- Confirm receipt page opens without auth error.
- Confirm Payments Summary and Outstanding reports refresh correctly.
- Run receipt modal flow tests (no redirect, print works, currency matches settings).
- Run receipts migration and test POS receipt printing + receipts report tabs.

## Notes for new sessions
- If there are uncommitted changes, capture them in "Current Focus" and do not redo work.
- Use `git diff` to understand what already changed before coding.
