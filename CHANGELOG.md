# CHANGELOG - UI/UX Redesign

## v2.0.0 - Complete Premium Redesign (2026-01-15)

### 🎨 Design System
- **NEW**: Unified MUI Theme (`frontend/src/theme/index.js`)
  - Light/Dark mode palettes with premium color tokens
  - Consistent typography scale (Inter font family)
  - Component overrides for buttons, inputs, cards, tables
  - Unified focus ring styling (no doubling)
  - Custom scrollbar styling

- **NEW**: RTL Support for Arabic
  - Added `stylis-plugin-rtl` package
  - Emotion cache configuration for automatic RTL

### 📱 Pages Redesigned

#### POS / Sales (`frontend/src/pages/Sales.jsx`)
- 3-panel layout: Products grid + Cart sidebar
- Product cards with 4:3 aspect ratio images
- Stock badges (green/red) on cards
- Cart with quantity controls
- Sticky "Proceed to Pay" button
- High-contrast checkout modal
- Lucide React icons

#### Products & Inventory (`frontend/src/pages/Products.jsx`)
- Table/Grid view toggle
- Image upload with immediate preview
- Cache-busting image URLs
- Stock management modal
- Full MUI theme integration

### 🐛 Bugs Fixed
- ✅ `ToggleButtonGroup` undefined error
- ✅ "Proceed to Pay" button not working
- ✅ Checkout modal unreadable in dark mode
- ✅ Product images not displaying after upload
- ✅ Report API "Route not found" errors
- ✅ Error toast spam (debounced)

### 📦 Dependencies Added
- `stylis` ^4.x
- `stylis-plugin-rtl` ^2.x

### 🔧 Backend Verified
- `POST /api/sales` - Creates SaleTransaction + SaleItems + StockMovement
- Report endpoints all functional

---

## Run Commands

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend  
cd backend && npm install && npm run dev
```

**Frontend URL**: http://localhost:5173 (or 5174 if busy)
**Backend URL**: http://localhost:3001
