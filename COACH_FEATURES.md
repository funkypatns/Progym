# Coach Features (Master Update)

## 1. Advanced Booking System
The booking flow has been enhanced for simplicity and reliability.

### **Availability Preview**
- **Smart Booking Modal**: Now splits "Date" and "Start Time" for easier selection.
- **Conflict Detection**: The system immediately warns staff if a selected time slot overlaps with an existing booking.
- **Visual Schedule**: Added a **"👁️ View Schedule"** button next to the Coach selector. This opens a visual timeline of the coach's bookings for the next 7 days.

### **Double Booking Prevention**
- **Client-Side**: Visual warning ("Time slot overlap detected!") disables the submit button.
- **Server-Side**: Strict validation prevents concurrent bookings for the same coach.

## 2. Auto-Completion & Attendance
The "Auto-Close" logic is now intelligent.

- **Check-In Verification**: When a session ends, the system checks if the member **Checked In** at the gym within a reasonable window (1 hour before -> session end).
- **Status Outcome**:
  - **Member Checked In** → Status becomes `auto_completed` (Commission generated).
  - **No Check-In** → Status becomes `no_show` (No Commission).
- **Timing**: Job runs every minute, processing sessions 10 minutes after they end.

## 3. Coach Earnings & Settlement
- **Unique Earnings**: Logic ensures exactly ONE earning record per session.
- **Settlement Flow**:
  - Go to **Reports > Coach Earnings**.
  - Select Coach.
  - View "Pending Payout" card.
  - Click **"Settle"** to mark earnings as paid and create an Expense record.

## 4. Notifications Center
Located at `/notifications/sessions`.
Now features **3 dedicated tabs**:
1.  **Auto Completed**: Sessions successfully closed.
2.  **Cancelled**: Manually cancelled sessions.
3.  **No-show**: Sessions where member did not check in.

## How to Test
1.  **Check Availability**:
    - Go to Appointments.
    - Click "New Appointment".
    - Select a Coach and Date.
    - Click the "Eye" icon to see their schedule.
    - Try to pick a time that overlaps → Observe warning.
2.  **Auto-Close**:
    - Create a session that ends 10 mins ago.
    - (Optional) Create a Check-In for that member.
    - Wait for background job (or check status later).
    - Session should turn `auto_completed` (if checked in) or `no_show`.
3.  **Notifications**:
    - Go to Notifications page to see the events.
