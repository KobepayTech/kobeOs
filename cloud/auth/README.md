# cloud/auth

Authentication layer. Source: `server/src/auth/`.

- JWT access tokens (15 min expiry) + refresh tokens (7 days)
- Password reset via email (SendGrid or SMTP)
- Role-based access: `user` | `admin`
- Admin endpoints require `@Roles('admin')` guard
