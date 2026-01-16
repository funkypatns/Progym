# 🔌 API Reference

Complete API documentation for the Gym Management System.

**Base URL:** `http://localhost:5000/api`

**Authentication:** Most endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication

### POST /auth/login
Login and get access token.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  }
}
```

### GET /auth/me
Get current authenticated user.

### POST /auth/logout
Logout current session.

---

## 👥 Members

### GET /members
List all members with pagination.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status: `active`, `inactive`
- `search` - Search by name, email, phone, or member ID

### GET /members/:id
Get member by ID.

### POST /members
Create a new member.

**Request:**
```json
{
  "firstName": "Ahmed",
  "lastName": "Hassan",
  "email": "ahmed@example.com",
  "phone": "+201234567890",
  "gender": "male",
  "dateOfBirth": "1990-01-15",
  "address": "Cairo, Egypt"
}
```

### PUT /members/:id
Update member.

### DELETE /members/:id
Delete member.

### GET /members/search/:query
Search members by name or ID.

---

## 📋 Subscriptions

### GET /subscriptions
List all subscriptions.

**Query Parameters:**
- `status` - Filter: `active`, `expired`, `frozen`
- `memberId` - Filter by member

### POST /subscriptions
Create subscription for a member.

**Request:**
```json
{
  "memberId": 1,
  "planId": 2,
  "startDate": "2024-01-01T00:00:00Z",
  "paidAmount": 0
}
```

### PUT /subscriptions/:id/renew
Renew a subscription.

**Request:**
```json
{
  "planId": 3
}
```

### PUT /subscriptions/:id/freeze
Freeze subscription.

**Request:**
```json
{
  "days": 7
}
```

### PUT /subscriptions/:id/unfreeze
Unfreeze subscription.

### PUT /subscriptions/:id/cancel
Cancel subscription (Admin only).

---

## 💰 Payments

### GET /payments
List all payments.

### POST /payments
Record a new payment.

**Request:**
```json
{
  "memberId": 1,
  "subscriptionId": 5,
  "amount": 100,
  "method": "cash",
  "notes": "First installment"
}
```

**Notes:**
- `subscriptionId` is optional. If provided, updates the subscription's `paidAmount`.
- `method` options: `cash`, `card`, `transfer`

### GET /payments/summary/stats
Get payment statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 5000,
    "paymentCount": 25,
    "byMethod": {
      "cash": 3000,
      "card": 1500,
      "transfer": 500
    }
  }
}
```

---

## 🚪 Check-In

### POST /checkin
Check in a member.

**Request:**
```json
{
  "memberId": "GYM-001",
  "method": "manual"
}
```

### POST /checkin/checkout
Check out a member.

**Request:**
```json
{
  "memberId": "GYM-001"
}
```

### GET /checkin/today
Get today's check-ins.

### GET /checkin/active
Get currently active members (checked in, not checked out).

---

## 📋 Plans

### GET /plans
List all subscription plans.

**Query Parameters:**
- `active` - Filter: `true` for active plans only

### POST /plans
Create a new plan.

**Request:**
```json
{
  "name": "Monthly Basic",
  "nameAr": "الشهري الأساسي",
  "duration": 30,
  "price": 100,
  "description": "Basic gym access"
}
```

### PUT /plans/:id
Update a plan.

### DELETE /plans/:id
Soft-delete a plan.

---

---

## 🧾 Cash Closings & Collection Reports

### GET /cash-closings/monthly-summary
Get monthly collection summary per employee.

**Query Parameters:**
- `month` - Year and Month (format: `YYYY-MM`)

### GET /cash-closings/employee-payments
Get detailed list of payments for a specific employee.

**Query Parameters:**
- `employeeId` - Employee ID
- `startDate` - Start date
- `endDate` - End date

### GET /cash-closings/calculate-expected
Preview expected totals for a period before closing.

**Query Parameters:**
- `startAt` - Start date/time
- `endAt` - End date/time
- `employeeId` - (Optional) Filter by specific employee

### POST /cash-closings
Create a new cash closing record (Immutable).

**Request Body:**
```json
{
  "employeeId": 1,
  "periodType": "daily",
  "startAt": "2024-01-01T00:00:00Z",
  "endAt": "2024-01-01T23:59:59Z",
  "declaredCashAmount": 1000,
  "declaredNonCashAmount": 500,
  "notes": "End of shift closing"
}
```

### GET /cash-closings
List all cash closing records.

---

## 📊 Reports

### GET /reports/members
Get members report.

### GET /reports/revenue
Get revenue report.

**Query Parameters:**
- `from` - Start date (ISO format)
- `to` - End date (ISO format)

### GET /reports/attendance
Get attendance report.

### GET /reports/subscriptions
Get subscriptions report.

---

## ⚙️ Settings

### GET /settings
Get all settings.

### PUT /settings
Update settings.

**Request:**
```json
{
  "gym_name": "My Gym",
  "currency_symbol": "$",
  "primary_color": "#3B82F6"
}
```

### POST /settings/reset
Clear system data.

**Request:**
```json
{
  "targets": ["payments", "subscriptions"],
  "date": "2024-01-01"
}
```

**Targets:**
- `members` - Delete all members
- `payments` - Delete all payments
- `subscriptions` - Delete all subscriptions
- `logs` - Delete all activity logs
- `all` - Delete everything (Factory Reset)

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
- `MEMBER_NOT_FOUND` - Member does not exist
- `SUBSCRIPTION_EXPIRED` - Member's subscription has expired
- `ALREADY_CHECKED_IN` - Member already checked in today
- `VALIDATION_ERROR` - Invalid input data
