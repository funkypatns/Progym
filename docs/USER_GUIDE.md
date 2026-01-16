# 📖 User Guide - Gym Management System

A complete guide on how to use all features of the Gym Management System.

---

## 🔐 Login

1. Open the application at `http://localhost:5173`
2. Enter your credentials:
   - **Admin**: `admin` / `admin123`
   - **Staff**: `staff` / `staff123`
3. Click **Login**

---

## 👥 Managing Members

### Add a New Member

1. Go to **Members** from the sidebar
2. Click **+ Add Member**
3. Fill in the required fields:
   - First Name, Last Name
   - Phone, Email
   - Gender
4. (Optional) Assign a **Subscription Plan**
5. Click **Save**

### Edit a Member

1. Find the member in the list
2. Click the **Edit** (pencil) icon
3. Modify the details
4. Click **Save**

### Delete a Member

1. Find the member in the list
2. Click the **Delete** (trash) icon
3. Confirm the deletion

---

## 📋 Managing Subscriptions

### Assign a Subscription

1. Go to **Subscriptions** from the sidebar
2. Click **+ Assign Subscription**
3. Search for a member
4. Select a plan
5. Click **Assign**

### Renew a Subscription

1. Find the subscription in the list
2. Click the **Renew** (refresh) icon
3. Choose a new plan (or keep the same)
4. Click **Confirm Renewal**

### Freeze/Unfreeze

- Click the **Pause** icon to freeze (stops the countdown)
- Click the **Play** icon to unfreeze

---

## 💰 Recording Payments

### Add a Payment

1. Go to **Payments** from the sidebar
2. Click **Record Payment**
3. Search for a member
4. (Optional) **Link to Subscription** - Select the member's active subscription
   - This enables **Installment Payments**
   - The system will auto-fill the remaining amount
5. Enter the amount
6. Choose payment method (Cash, Card, Transfer)
7. Click **Record Payment**

### Understanding Payment Status

In the **Subscriptions** page, you'll see:
- 🟢 **Paid** - Full amount received
- 🟡 **Partial** - Some amount received (shows paid/total and remaining)
- 🔴 **Unpaid** - No payment received

---

## 🚪 Check-In System

### Manual Check-In

1. Go to **Check-In** from the sidebar
2. Select **Manual** mode
3. Enter the member's ID (e.g., `GYM-001`)
4. Click **Check In**

### Check-Out

1. Find the member in "Today's Attendance" list
2. Click the **Check Out** icon

---

## 📊 Reports

### Generate a Report

1. Go to **Reports** from the sidebar
2. Select report type:
   - Members Report
   - Revenue Report
   - Attendance Report
   - Subscriptions Report
3. Set date range (From/To)
4. Click **Generate**

### Export Report

1. Generate a report
2. Click **Export Excel** to download

---

## ⚙️ Settings

### General Settings

1. Go to **Settings** from the sidebar
2. In **General** tab:
   - Set Gym Name (English & Arabic)
   - Set Phone, Email, Address
   - Choose Currency

### Branding

1. Go to **Branding** tab
2. Upload your logo
3. Choose primary/secondary colors

### Backup & Restore

1. Go to **Backup** tab
2. Click **Create Backup** to save your data
3. To restore, select a backup and click **Restore**

### Data Management (Reset)

1. Go to **Data Management** tab
2. Select what to clear:
   - ☐ Members
   - ☐ Payments
   - ☐ Subscriptions
   - ☐ Logs
3. (Optional) Set a date to clear data older than
4. Click **Clear Selected**

Or use **Factory Reset** to delete everything.

---

## 🌍 Language Switching

1. Click the **Language** icon in the top navigation
2. Select **English** or **العربية** (Arabic)

The entire interface will switch, including RTL support for Arabic.

---

## 🌙 Dark/Light Mode

1. Click the **Moon/Sun** icon in the top navigation
2. The theme will toggle between dark and light

---

## ❓ Troubleshooting

### "Cannot connect to server"
- Make sure the backend is running: `cd backend && npm run dev`

### "Login failed"
- Check your username and password
- Default: `admin` / `admin123`

### "Member not found"
- Ensure you're using the correct Member ID (e.g., `GYM-001`)

---

## 📞 Support

For issues or feature requests, please contact your system administrator.
