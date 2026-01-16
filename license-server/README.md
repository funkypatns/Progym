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

## API Endpoints

### Public (Client)
- `POST /api/licenses/activate` - Activate a license
- `POST /api/licenses/validate` - Validate license + hardware
- `GET /api/licenses/status/:key` - Quick status check

### Admin (Protected)
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
