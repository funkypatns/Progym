# Coach Earnings Report - Implementation Summary

## What Was Fixed

The Coach Earnings report was showing no data because it was querying a `CoachEarning` table that only gets populated when the commission processing hook runs. This meant:
- Old payments had no earnings records
- If the hook failed, no data would show
- Data was incomplete

## Solution Implemented

### Backend Changes (`commissionService.js`)

**New `getEarnings` function:**
- Now calculates earnings directly from **existing Payment records**
- Queries all payments linked to appointments with the specified coach
- Calculates commission on-the-fly using coach's commission settings
- Returns detailed breakdown with summary statistics

**Data Sources:**
- `Payment` table (where `appointmentId` is not null and status = 'completed')
- Filters by `appointment.coachId` to get only payments for this coach's sessions
- Uses `CoachCommissionSettings` for commission rates
- Checks `CoachEarning` table for payment status (pending/paid)

**Response Format:**
```javascript
{
  summary: {
    sessionsCount: 5,
    totalPaid: 1000,
    totalCommission: 100,
    pendingCommission: 60,
    paidCommission: 40
  },
  rows: [
    {
      id, date, customerName, sourceType, sourceRef,
      appointmentId, paymentId, paidAmount, commissionRate,
      commissionAmount, status, notes, createdAt
    }
  ],
  settings: { type: 'percentage', value: 10 }
}
```

### Frontend Changes (`CoachEarningsModal.jsx`)

- Updated state management to handle `{summary, rows}` structure
- Stats cards now use `summary.totalCommission` and `summary.pendingCommission`
- Added "Customer" column to show member names
- Improved table layout with proper formatting
- Shows commission amounts with decimals for accuracy

## How It Works Now

1. **User clicks EARNINGS** on a coach card
2. **Frontend requests** `/api/coaches/:id/earnings?startDate=...&endDate=...`
3. **Backend queries** all payments for that coach's completed appointments
4. **Calculates commission** based on coach settings (percentage or fixed)
5. **Returns** summary stats + detailed rows
6. **Frontend displays** earnings table with customer info and amounts

## Test Scenario

To see earnings:
1. Create an appointment with a coach
2. Complete the appointment
3. Process payment for that appointment
4. Go to Coaches page
5. Click EARNINGS on that coach
6. You should see the payment with calculated commission

## Key Features

✅ Works with existing payments (no migration needed)
✅ Handles partial payments correctly
✅ Shows customer names
✅ Calculates commission in real-time
✅ Supports both percentage and fixed commission types
✅ Filters by date range
✅ Shows pending vs paid status
