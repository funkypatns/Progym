# License Security Flow (Post-Licensing Layer)

## Overview
This project now enforces license-device binding with signed tokens and periodic validation.

- Device identity is based on machine-id fingerprint (not IP).
- License server signs activation/validation tokens with `RS256`.
- Client (backend app) verifies signatures locally with server public key.
- Device mismatch, revoked devices, revoked licenses, and integrity failures block app usage.

## Activation Flow
1. App computes `deviceFingerprint` from machine-id.
2. App calls `POST /api/license/activate` with `licenseKey`, `gymName`.
3. Backend sends to license server:
   - `POST /api/licenses/activate`
   - payload: `licenseKey`, `deviceFingerprint`, `gymName`, `appVersion`, device info.
4. Server behavior:
   - First approved device auto-binds to license.
   - New/unapproved device is blocked with `DEVICE_NOT_APPROVED`.
   - Device records are tracked per license.
5. Server returns signed activation token (`RS256`).
6. Backend verifies token signature + fingerprint match before caching encrypted locally.

## Startup / Runtime Enforcement
On startup (`/api/license/status`):
1. Load encrypted local cache.
2. Verify activation token signature and fingerprint locally.
3. Validate integrity manifest signatures and critical file hashes.
4. Attempt online validation with license server.
5. If offline, allow run only within offline grace window.

Blocking conditions include:
- `DEVICE_NOT_APPROVED`
- `LICENSE_REVOKED`
- `DEVICE_FINGERPRINT_MISMATCH`
- `INTEGRITY_MISMATCH`
- `GRACE_EXPIRED`

## Periodic Validation and Offline Grace
- Validation target interval: 24 hours (`LICENSE_VALIDATE_INTERVAL_HOURS`).
- Offline grace: 72 hours (`LICENSE_OFFLINE_GRACE_HOURS`).
- Background validation loop runs hourly and revalidates when due.

## Device Management APIs
Gym backend exposes admin-protected endpoints:

- `GET /api/licenses`
- `GET /api/licenses/:key/devices`
- `POST /api/licenses/:key/devices/:deviceId/approve`
- `POST /api/licenses/:key/devices/:deviceId/revoke`
- `POST /api/licenses/:key/reset-devices`
- `PATCH /api/licenses/:key` (`device_limit`, `status`)
- `POST /api/licenses/:key/revoke`

License server persists audit logs for all state-changing actions.

## Integrity Manifest
- License server serves signed manifest via:
  - `GET /api/licenses/manifest/:appVersion`
- Manifest file source:
  - `license-server/data/integrity-manifests.json`
- Regenerate manifest hashes after critical code updates:
  - `cd license-server && npm run manifest:generate`

## Server-side Key Rules
- Keep `LICENSE_PRIVATE_KEY` only on license server.
- Clients verify only with `LICENSE_PUBLIC_KEY` / public key endpoint.
- Use `LICENSE_ADMIN_TOKEN` to authorize device-management endpoints.