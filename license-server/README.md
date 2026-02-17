# License Server

License validation server for Gym Management System.

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm run dev
```

Server runs on: `http://localhost:4000`

## Default Admin Credentials

- **Username:** admin
- **Password:** LicenseAdmin123!
- Set `LICENSE_ADMIN_JWT_SECRET` in production for `/admin/*` routes.

## API Endpoints

### Public (Client)
- `POST /api/licenses/activate` - Activate a license
- `POST /api/licenses/validate` - Validate license + hardware
- `POST /api/licenses/heartbeat` - Heartbeat (last seen update)
- `GET /api/licenses/status/:key` - Quick status check

### License Admin Dashboard (Separate Auth)
- `GET /admin/login` - Dashboard login page
- `POST /admin/auth/login` - License admin login
- `GET /admin/licenses` - List licenses with device counts
- `GET /admin/licenses/:id/devices` - List devices for a license
- `POST /admin/devices/:id/approve` - Approve a device
- `POST /admin/devices/:id/revoke` - Revoke a device
- `POST /admin/licenses/:id/reset` - Reset all devices for a license

### Legacy Admin API (Protected)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/licenses` - List all licenses
- `POST /api/admin/licenses` - Create new license
- `PUT /api/admin/licenses/:id/status` - Update status
- `DELETE /api/admin/licenses/:id` - Delete license
- `GET /api/admin/stats` - Dashboard stats

## Creating a License (Admin)

1. Login to get token
2. POST to `/api/admin/licenses` with:
```json
{
  "type": "standard",
  "ownerName": "John Doe",
  "ownerEmail": "john@gym.com",
  "gymName": "Muscle Factory",
  "maxMembers": 100,
  "expiresAt": "2025-12-31"
}
```

## Testing with Seed Data

```bash
npm run seed
```

This creates sample licenses for testing.
