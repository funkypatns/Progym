# Vendor Support Info

## Purpose
- Vendor contact details are managed only in `license-server`.
- Gym clients can only read support info from `GET /api/public/vendor-profile`.
- This public endpoint does not require license validity.

## License-Server Admin Login
1. Open `http://<license-server-host>:4000/admin/login`.
2. Login with license-server admin credentials (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
3. Open `http://<license-server-host>:4000/admin/vendor-profile`.
4. Update fields and click `Save`.

## Client Integration
- Gym app reads support info from `VITE_LICENSE_SERVER_BASE_URL + /api/public/vendor-profile`.
- Gym app uses a separate HTTP client (no gym auth interceptor) for this endpoint.
- Last successful support profile is cached locally for offline fallback.

## Security Notes
- Admin APIs are protected with license-admin JWT (`LICENSE_ADMIN_JWT_SECRET`), separate from gym auth.
- Public endpoint is read-only and lightly rate-limited.
- Gym system has no support edit UI and cannot modify vendor profile.
