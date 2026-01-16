# Deployment Configuration Summary

## Files Changed for Production Deployment

### 1. Backend Changes

#### `backend/prisma/schema.prisma`
- **Changed**: Datasource provider from `sqlite` to `postgresql`
- **Why**: Production databases use PostgreSQL instead of SQLite

#### `backend/server.js`
- **Changed**: CORS configuration to use `process.env.CORS_ORIGIN`
- **Before**: `origin: isDev ? 'http://localhost:5173' : 'file://'`
- **After**: `origin: process.env.CORS_ORIGIN || (isDev ? 'http://localhost:5173' : '*')`
- **Why**: Allows dynamic CORS configuration for Vercel frontend URL

#### `backend/.env.example` (NEW FILE)
- **Purpose**: Template for required environment variables
- **Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `JWT_SECRET`: JWT signing secret
  - `CORS_ORIGIN`: Frontend URL for CORS
  - `PORT`: Server port (Render uses `PORT`)
  - `NODE_ENV`: production
  - `USER_DATA_PATH`: File upload directory

### 2. Frontend Changes

#### `frontend/src/utils/api.js`
- **Changed**: Axios baseURL to use environment variable
- **Before**: `baseURL: '/api'` (always uses proxy)
- **After**: `baseURL: import.meta.env.VITE_API_BASE_URL || '/api'`
- **Why**: Production needs to call Render API URL directly

#### `frontend/.env.example` (NEW FILE)
- **Purpose**: Template for Vercel environment variables
- **Variables**:
  - `VITE_API_BASE_URL`: Backend API URL (from Render)

#### `frontend/vercel.json` (NEW FILE)
- **Purpose**: Configure React Router SPA fallback
- **Content**: Rewrites all routes to `/` for client-side routing
- **Why**: Prevents 404 errors when refreshing on sub-routes

### 3. Repository Setup

#### `.gitignore` (NEW FILE)
- **Purpose**: Exclude sensitive and build files
- **Excludes**:
  - `node_modules/`
  - `.env` files
  - `dist/` and `build/` directories
  - Local data directories (`data/`, `uploads/`, etc.)

#### Git Repository
- Initialized Git repository
- All deployment changes committed

---

## Render Configuration (Backend)

### Build Settings
```yaml
Root Directory: backend
Build Command: npm ci && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
```

### Environment Variables
```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=<generate-with-openssl-rand-base64-32>
NODE_ENV=production
CORS_ORIGIN=https://your-app.vercel.app
PORT=10000
USER_DATA_PATH=/tmp/gym-data
```

---

## Vercel Configuration (Frontend)

### Build Settings
```yaml
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

### Environment Variables
```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

---

## Required Secrets/Credentials

You need to provide:

1. **DATABASE_URL**: Your PostgreSQL connection string
   - Format: `postgresql://username:password@host:port/database`
   - Must be accessible from Render's IP addresses

2. **JWT_SECRET**: Secure random string
   - Generate with: `openssl rand -base64 32`
   - Minimum 32 characters

3. **GitHub Repository**: 
   - Create at: https://github.com/new
   - Name: `gym-management-system` (or your choice)

---

## Next Steps

1. **Create GitHub Repository**
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/gym-management-system.git
   git push -u origin main
   ```

2. **Deploy to Render**
   - Sign up at https://render.com
   - Create Web Service from GitHub repo
   - Set root directory to `backend`
   - Add environment variables
   - Deploy

3. **Deploy to Vercel**
   - Sign up at https://vercel.com
   - Import GitHub repository
   - Set root directory to `frontend`
   - Add `VITE_API_BASE_URL` environment variable
   - Deploy

4. **Update CORS**
   - After Vercel deploys, copy the URL
   - Update `CORS_ORIGIN` in Render to match Vercel URL
   - Render will auto-redeploy

5. **Verify**
   - Test `/api/health` endpoint on Render
   - Test login on Vercel URL
   - Check for CORS errors in browser console

---

## Important Notes

- ⚠️ **Render Free Tier**: Service spins down after 15 min inactivity (30s cold start)
- ✅ **Vercel**: Always-on, global CDN, automatic HTTPS
- 🔒 **Security**: Never commit `.env` files with real credentials
- 📦 **Database**: Ensure PostgreSQL migrations run on first deploy
- 🔄 **Updates**: Push to GitHub → Auto-deploys to Render & Vercel

---

**Status**: ✅ Project ready for deployment  
**Action Required**: Provide DATABASE_URL and JWT_SECRET, create GitHub repo
