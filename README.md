# ChatShop - Razorpay Integration

A full-stack chat interface with product catalog and Razorpay payment integration.

## Setup Instructions

### 1. Razorpay Test Keys

Get your test keys from [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys) → Test Mode.

Edit `backend/.env`:
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Start Backend

```bash
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:3000

## Test Card

- Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVV: Any 3 digits
