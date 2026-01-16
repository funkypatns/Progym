# 🛠️ Installation Guide

Complete installation instructions for the Gym Management System.

---

## Prerequisites

Before installing, ensure you have:

- **Node.js** version 18.0.0 or higher
- **npm** (comes with Node.js)
- **Git** (optional, for cloning)

### Check Node.js Version
```bash
node --version
```

If not installed, download from: https://nodejs.org/

---

## Step-by-Step Installation

### 1. Get the Project Files

**Option A: Clone from Git**
```bash
git clone <repository-url>
cd gym-management-system
```

**Option B: Extract from ZIP**
- Extract the ZIP file
- Open terminal in the extracted folder

---

### 2. Install Backend

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install
```

---

### 3. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Create database and apply schema
npx prisma db push

# Seed initial data (plans, admin user, sample members)
npm run seed
```

You should see:
```
✅ Created admin user: admin
✅ Created staff user: staff
✅ Created subscription plans: 4
✅ Created default settings: 18
✅ Created sample members: 3
🎉 Database seeded successfully!
```

---

### 4. Install Frontend

```bash
# Navigate to frontend folder
cd ../frontend

# Install dependencies
npm install
```

---

### 5. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see:
```
🏋️ Gym Management System API
Server running on port 5000
📦 Database: Connected
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.0.10  ready in XXX ms

➜  Local:   http://localhost:5173/
```

---

### 6. Access the Application

Open your browser and go to:
```
http://localhost:5173
```

Login with:
- **Username:** `admin`
- **Password:** `admin123`

---

## Production Build

### Build Frontend
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`.

### Run Backend in Production
```bash
cd backend
npm start
```

---

## Database Location

The SQLite database is stored at:
```
backend/prisma/gym.db
```

To backup, simply copy this file.

---

## Troubleshooting

### "Cannot find module" Error
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Database Issues
```bash
# Reset and recreate database
npx prisma db push --force-reset
npm run seed
```

### Port Already in Use
- Backend default: `5000`
- Frontend default: `5173`

Change in:
- Backend: Edit `PORT` in `.env` or `server.js`
- Frontend: Run `npm run dev -- --port 3000`

---

## Next Steps

1. Read the [User Guide](./USER_GUIDE.md)
2. Configure your gym settings
3. Add your members
4. Start managing subscriptions!
