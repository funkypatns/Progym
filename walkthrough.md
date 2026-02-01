# Appointments & Coach Commission System

I have successfully implemented the **Appointments** and **Coach Commissions** features in the Gym Management System.

## Features Implemented

### 1. Appointments Management
*   **New Page**: `Appointments` (accessible via sidebar).
*   **Views**: Toggle between **Calendar View** (monthly grid) and **List View**.
*   **Booking**: Book appointments for members with specific coaches.
*   **Status Tracking**: Manage status (Scheduled, Completed, Cancelled).
*   **Payment Integration**: Directly pay for appointments upon completion.

### 2. Coach Commissions
*   **New Page**: `Coach Management` (accessible via sidebar "Coaches").
*   **Commission Rules**: Configure commission settings per coach (Percentage or Fixed Amount).
*   **Earnings Tracking**: Track earnings for each completed appointment.
*   **Settlement**: View pending earnings and settle payouts (creates expense records).

### 3. Backend Enhancements
*   **Database**: Added `Appointment`, `CoachCommissionSettings`, and `CoachEarning` tables.
*   **API**:
    *   `GET /appointments`, `POST /appointments`, `PUT /appointments/:id`
    *   `GET /coaches/:id/settings`, `PUT /coaches/:id/settings`
    *   `GET /coaches/:id/earnings`, `POST /coaches/settle`
*   **Permissions**: granular permissions for `appointments.*` and `coaches.*`.

## How to Test

1.  **Restart the Server**:
    *   Stop your running backend server (Ctrl+C).
    *   Run `npm run dev` in the backend folder.
    *   Ensure the frontend is also running (updates should hot-reload, but refresh the page).

2.  **Configure Permissions**:
    *   As an Admin, go to **Settings > Employees**.
    *   Edit your staff role permissions or ensure you are logged in as Admin (Super Admin has all access).

3.  **Book an Appointment**:
    *   Go to **Appointments**.
    *   Click **Book Appointment**.
    *   Select a Member and a Coach.
    *   Set price and time.
    *   Save.

4.  **Complete & Pay**:
    *   In Appointments, click the checkmark to complete the session.
    *   If unpaid, the Payment Dialog will open.
    *   Process the payment (Cash/Card).

5.  **Check Commissions**:
    *   Go to **Coaches**.
    *   Click **Settings** on a coach card to set up their commission (e.g., 10%).
    *   (Note: Commissions are calculated when payment is recorded. If you set settings *after* payment, it applies to *future* payments. For testing, set settings first, then book & pay).
    *   Click **Earnings** to view the report.
    *   Verify the commission amount matches your settings.

## Alerts & Notes
*   **Prisma Client**: I have automatically regenerated the Prisma Client. If you see database errors, please try running `npx prisma generate` in the backend folder manually.
*   **Navigation**: New items "Appointments" and "Coaches" have been added to the sidebar.
