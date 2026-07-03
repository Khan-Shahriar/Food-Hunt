# Food Hunt Authentication

Full email/password authentication for the Food Hunt app.

## Requirements

- [Node.js 18+](https://nodejs.org/)

## Setup

```bash
cd server
npm install
npm start
```

Open **http://localhost:8080**

## Auth flow

1. **Sign up** — name, office, email, password (min 8 chars, upper, lower, number, special)
2. **Email verification** — link printed in the server console (dev mode)
3. **Login** — requires verified email; optional **Remember me** (30-day cookie)
4. **Dashboard** — protected; session stored in secure httpOnly cookie (`fh_token`)
5. **Forgot password** — reset link printed in server console
6. **Profile / Settings** — update name, email, password, or delete account
7. **Logout** — clears session cookie

## Database

SQLite file: `data/foodhunt.db`

**Users table fields:** id, full_name, email, password_hash, office_name, profile_picture, email_verified, account_status, role, created_at, last_login, failed_login_attempts, locked_until

Passwords are hashed with **bcrypt** (12 rounds). Plain passwords are never stored.

## Security included

- Password strength rules + weak password blocklist
- Rate limiting on auth routes
- Account lock after 5 failed logins (15 min)
- JWT in httpOnly, SameSite=strict cookie
- Email must be verified before login
- Banned account check
- Role field on users (`user`, `moderator`, `admin`, `super_admin`)

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/verify-email?token=` | Verify email |
| POST | `/api/auth/forgot-password` | Request reset |
| POST | `/api/auth/reset-password` | Set new password |
| GET | `/api/dashboard` | Protected dashboard data |
| PUT | `/api/user/profile` | Update profile |
| PUT | `/api/user/password` | Change password |
| DELETE | `/api/user/account` | Delete account |

## Production notes

Set environment variables:

```bash
JWT_SECRET=your-long-random-secret
APP_URL=https://your-domain.com
NODE_ENV=production
```

Use HTTPS, connect a real email provider (SMTP), and add Google/Phone OAuth when ready.
