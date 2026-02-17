# Gym Management System - Complete Redesign

## 🚀 Quick Start

### Backend
```powershell
docker compose up -d postgres
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
Server runs on: http://localhost:3001

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
App runs on: http://localhost:5173 (or 5174 if busy)

### Login
- **Username:** admin
- **Password:** admin123

---

## ✨ What's New (v2.0.0)

### 🎨 Design System
- **MUI Theme** with Light/Dark mode support
- **RTL Support** for Arabic language
- Premium color palette with consistent tokens
- Unified focus rings and component styling

### 📱 Redesigned Pages
- **POS/Sales**: 3-panel layout, sticky checkout, product cards
- **Products**: Table/Grid toggle, image upload with preview
- **Reports**: Card-based landing, detailed report pages
- **All Modules**: Consistent dark theme styling

### 🐛 Bugs Fixed
- ToggleButtonGroup crash
- Checkout modal dark mode contrast
- Image upload display issues
- Error toast spam
- Report API route mismatches

---

## 🧪 Testing Checklist

| Flow | Status |
|------|--------|
| Login → Dashboard | ✅ |
| POS → Add to cart → Checkout | ✅ |
| Complete sale → Stock update | ✅ |
| Reports → View data | ✅ |
| Members → CRUD operations | ✅ |
| Dark/Light toggle | ✅ |
| Arabic RTL mode | ✅ |

---

## 📁 Key Files Changed

| File | Change |
|------|--------|
| `frontend/src/theme/index.js` | New theme system |
| `frontend/src/main.jsx` | ThemeProvider + RTL |
| `frontend/src/pages/Sales.jsx` | Complete redesign |
| `frontend/src/pages/Products.jsx` | Complete redesign |
| `frontend/src/styles/index.css` | Enhanced dark mode |

---

## Session Packs (باقات الجلسات)

### What was added
- New navigation + page: `باقات الجلسات` (`/session-packs`)
- Pack templates API alias: `/api/pack-templates`
- Pack assignments API: `/api/pack-assignments`
- Pack attendance/check-in history per assignment
- Idempotent check-in deduction using `Idempotency-Key`

### How to use in UI
1. Open **الخطط** and create package templates (sessions + validity + price).
2. Open **باقات الجلسات**.
3. Click **Assign Pack +**.
4. Select member + pack template, set payment method/status/amount (and optional session name/price override), then **Assign**.
5. From table actions:
   - **View**: opens assignment details + attendance history
   - **Check-in**: deducts exactly 1 session
   - **Pause/Resume**: changes assignment status

### Business rules implemented
- Assignment starts with `remainingSessions = totalSessions`.
- Check-in is transactional:
  - validates active + not expired + remaining > 0
  - decrements by 1
  - writes attendance row
  - auto marks exhausted when remaining reaches 0
- Repeated check-in with the same idempotency key returns existing result (no second decrement).
