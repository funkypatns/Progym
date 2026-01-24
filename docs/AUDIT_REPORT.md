# Audit Report

Repository: D:\Omar gym project\gym-management-system
Branch: chore/site-audit-reports-ui
Date: 2026-01-23

## Automated Checks

- frontend lint: FAILED (eslint not installed in devDependencies; `npm run lint` cannot find eslint)
- frontend build: PASSED with warnings (large bundle size; tts.js dynamic import warning)
- backend build (prisma generate): FAILED (EPERM rename in `backend/node_modules/.prisma/client`)
- root build (electron-builder): FAILED (winCodeSign extraction symlink privilege error)
- dev smoke test: attempted `npm run dev` in backend/frontend, but command timed out; no UI smoke test performed in this environment

## Report Inventory (Routes -> Components -> Data Sources)

- /reports (Dashboard)
  - Component: frontend/src/pages/Reports/index.jsx
  - Nav: Reports sidebar (Dashboard)
  - Data: none (static cards)

- /reports/product-sales
  - Component: frontend/src/pages/Reports/ProductSalesReportPage.jsx
  - Nav: Reports sidebar
  - API: GET /api/reports/sales/detailed (from/to/search)
  - Export: uses format=excel but backend endpoint does not implement excel export

- /reports/revenue
  - Component: frontend/src/pages/Reports/StandardReportPage.jsx (type=revenue)
  - Nav: Reports sidebar
  - API: GET /api/reports/revenue (from/to, collectorId supported)
  - Frontend sends paymentMethod (unused by backend)

- /reports/members
  - Component: frontend/src/pages/Reports/StandardReportPage.jsx (type=members)
  - Nav: Reports sidebar
  - API: GET /api/reports/members (startDate/endDate/search)
  - Frontend sends from/to, not startDate/endDate

- /reports/subscriptions
  - Component: frontend/src/pages/Reports/StandardReportPage.jsx (type=subscriptions)
  - Nav: Reports sidebar
  - API: GET /api/reports/subscriptions (startDate/endDate/search)
  - Frontend sends from/to and method (unused)

- /reports/attendance
  - Component: frontend/src/pages/Reports/StandardReportPage.jsx (type=attendance)
  - Nav: Reports sidebar
  - API: GET /api/reports/attendance (startDate/endDate/search)
  - Frontend sends from/to, not startDate/endDate

- /reports/payments-summary
  - Component: frontend/src/pages/Reports/StandardReportPage.jsx (type=payments-summary)
  - Nav: Reports sidebar
  - API: GET /api/reports/payments/summary (from/to, employeeId)
  - Frontend sends paymentMethod (unused) and no employee filter

- /reports/employee-collections
  - Component: frontend/src/pages/Reports/EmployeeCollectionsPage.jsx
  - Nav: Reports sidebar
  - API: GET /api/reports/employee-collections (startDate/endDate/employeeId)
  - Extra param `type=employeeCollections` unused by backend

- /reports/shifts
  - Component: frontend/src/pages/Reports/ShiftReportsPage.jsx (ShiftReports component)
  - Nav: Reports sidebar
  - API: GET /api/pos/shifts (startDate/endDate, admin only)
  - Frontend expects startedAt/endedAt/endedCash fields that are not in API response

- /reports/receipts
  - Component: frontend/src/pages/Reports/ReceiptLookupPage.jsx (ReceiptLookupReport component)
  - Nav: Reports sidebar
  - API: GET /api/reports/receipts/lookup (q, scope)
  - Backend ignores scope; refund fields returned do not match frontend rendering

- /reports/pay-in-out
  - Component: frontend/src/pages/Reports/PayInOutReportPage.jsx (CashMovementsReport component)
  - Nav: Reports sidebar
  - API: GET /api/cash-movements (startDate/endDate/type)
  - Report endpoint /api/reports/payInOut exists but is not used; no Excel export in UI

- /reports/refunds
  - Component: frontend/src/pages/Reports/RefundsReportPage.jsx (RefundsReport component)
  - Nav: Reports sidebar
  - API: GET /api/reports/refunds (from/to/search/adminId)
  - Frontend sends startDate/endDate; summary field name mismatch

- /reports/cancellations
  - Component: frontend/src/pages/Reports/CancellationsReportPage.jsx (CancellationsReport component)
  - Nav: Reports sidebar
  - API: GET /api/reports/cancellations (from/to/search)
  - Frontend expects fields not returned by backend (member/plan/financials)

- /reports/outstanding
  - Component: frontend/src/pages/Reports/OutstandingReportPage.jsx (PaymentRemainingReport component)
  - Nav: Reports sidebar (Admin section)
  - API: GET /api/reports/payment-remaining (from/to/search/planId/status/employeeId/remainingOnly)
  - Backend ignores employeeId filter; frontend expects flattened fields

- /reports/cash-closing
  - Component: frontend/src/pages/Reports/CashClosingReportPage.jsx (CashClosingReport component)
  - Nav: Reports sidebar (Admin section)
  - API: should use GET /api/cash-closings (filters/pagination)
  - Current page does not fetch data; report shows empty state

## Broken or Missing Wiring (Priority)

1. Date range params mismatched across reports (from/to vs startDate/endDate), causing filters to be ignored.
2. Multiple reports render fields that do not exist in backend responses (shift reports, cancellations, outstanding payments, receipt refunds).
3. Cash closing report page does not fetch data at all.
4. Pay In/Out report uses /cash-movements instead of /reports/payInOut; Excel export missing.
5. Product sales export calls format=excel but backend does not implement Excel export for /reports/sales/detailed.
6. Refunds report summary uses data.totals but backend returns data.summary.
7. Employee filter missing or ignored in several reports (revenue, payments summary, outstanding, refunds).

## UI Inconsistencies

- Reports mix MUI-based layout (ReportsShell) with Tailwind-based pages (StandardReportPage/ProductSales).
- Multiple different filter bar styles and table wrappers across reports.
- Some pages use full-screen backgrounds (min-h-screen) inside a layout that already controls height/scroll, causing spacing/overflow inconsistencies.
- RTL alignment and icon placement are inconsistent across report pages.

## Console/Network Errors Observed or Likely

- Frontend lint cannot run (eslint missing).
- Backend prisma generate fails with EPERM rename in node_modules/.prisma/client.
- Electron build fails due to missing symlink privilege during winCodeSign extraction.
- Likely runtime errors where frontend expects missing fields (shift, cancellations, outstanding payments, receipt refunds).

## Prioritized Fix Plan

1. Normalize report query params (support from/to and startDate/endDate consistently) and align filters per report.
2. Fix data mapping per report page to match backend response shape; add missing fetches (cash closing) and exports.
3. Introduce shared report UI components (header/breadcrumb, filter bar, stats cards, table container, status chips, member code copy chip) and refactor report pages to use them.
4. Address RTL alignment, modal z-index/scroll, and dark theme readability polish.
5. Re-run builds and update this report with results and any remaining TODOs.
