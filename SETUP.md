# GramBank Project Setup Guide

This project is a complete banking application with a Node.js backend, React admin dashboard, and React Native mobile app.

## Project Structure

```
├── GramBankAPI/        - Node.js Express backend API
├── adminnew/           - React admin dashboard
└── mobilenew/          - React Native mobile app
```

## Prerequisites

- Node.js 16+ & npm
- MongoDB Atlas account
- Twilio account (for SMS OTP)
- IMGBB account (for image uploads)

## Backend Setup (GramBankAPI)

1. Navigate to GramBankAPI:
   ```bash
   cd GramBankAPI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from template:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your credentials:
   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   TWILIO_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_MSG_SID=your_twilio_messaging_sid
   IMGBB_API_KEY=your_imgbb_key
   PORT=5000
   ```

5. Start the server:
   ```bash
   npm start              # Production
   npm run dev            # Development (with nodemon)
   ```

Server runs on: `http://localhost:5000`

## Admin Dashboard Setup (adminnew)

1. Navigate to admin:
   ```bash
   cd adminnew
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update API URL in `.env`:
   ```
   REACT_APP_API_URL=http://localhost:5000/api
   ```

5. Start the dashboard:
   ```bash
   npm start
   ```

Dashboard runs on: `http://localhost:3000`

## Mobile App Setup (mobilenew)

1. Navigate to mobile:
   ```bash
   cd mobilenew
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update API URL:
   ```
   API_URL=http://localhost:5000/api
   ```

5. Start development:
   ```bash
   npm start              # Start Expo dev server
   ```

## API Endpoints

### Users
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/:id` - Get user details

### Transactions
- `GET /api/txns` - Get transactions
- `POST /api/txns/send` - Send money
- `GET /api/txns/history` - Transaction history

### OTP
- `POST /api/otp/send` - Send OTP
- `POST /api/otp/verify` - Verify OTP

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/analytics` - Analytics data

### Fraud Management
- `GET /api/fraud/list` - Get fraud accounts
- `POST /api/fraud/report` - Report fraud
- `PUT /api/fraud/:id/status` - Update fraud status

### Reports
- `GET /api/reports` - Get all reports
- `POST /api/reports/create` - Create report

## Environment Variables Reference

### Backend (GramBankAPI/.env)
```
MONGO_URI              MongoDB connection string (MongoDB Atlas)
JWT_SECRET             Secret key for JWT tokens
TWILIO_SID             Twilio Account SID
TWILIO_AUTH_TOKEN      Twilio Authentication Token
TWILIO_MSG_SID         Twilio Messaging Service ID
IMGBB_API_KEY          IMGBB API key for image uploads
PORT                   Server port (default: 5000)
NODE_ENV               development or production
```

### Frontend (adminnew/.env)
```
REACT_APP_API_URL      Backend API base URL
NODE_ENV               development or production
```

### Mobile (mobilenew/.env)
```
API_URL                Backend API base URL
NODE_ENV               development or production
```

## Database Models

- **User** - User account information
- **Transaction** - Transaction records
- **FraudAccount** - Fraud alerts
- **OTP** - One-time passwords
- **ChatMessage** - Live chat messages
- **TransactionReport** - User transaction reports
- **ScheduledTransaction** - Scheduled payments
- **TrustedReceiver** - Trusted payment recipients
- **UPICollectRequest** - UPI collection requests

## Deployment

### Backend to Render
1. Push to GitHub
2. Create Web Service on Render
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Add environment variables in Render dashboard
6. Deploy

### Frontend to Netlify/Vercel
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `build`

### Mobile
Deploy to Expo or build APK/IPA

## Troubleshooting

### MongoDB Connection Error
- Check MongoDB Atlas IP whitelist
- Verify connection string in `.env`
- Ensure cluster is active

### CORS Issues
- Backend has CORS enabled for all origins
- Check API_URL in frontend `.env`

### OTP Not Sending
- Verify Twilio credentials
- Check phone number format
- Ensure Twilio account has sufficient balance

## Security Notes

- ⚠️ Never commit `.env` files to version control
- Always use `.env.example` as template
- Rotate secrets regularly in production
- Use environment-specific credentials
- Keep JWT_SECRET strong and unique

## Support

For issues or questions, refer to the API documentation or contact the development team.

---

Last Updated: May 2025
