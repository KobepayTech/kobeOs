# KOBE OS v20 Plan

## 1. KobePay — Independent Payment App
- Separate app (not embedded in KOBECARGO)
- Roles: Admin, Cashier TZ, Cashier China
- Phone search → customer lookup/create
- Payout workflow: TZ cashier receives → China cashier confirms
- Bank-style receipts with QR

## 2. Kobetech Admin — Super Admin Portal
- Subscription management (view all companies, plans, fees)
- Payment tracking (incoming subscription fees)
- Module marketplace (enable/disable modules per company)
- User role management per company
- System health dashboard
- Company onboarding wizard

## 3. Kobetech DevOps — Developer Portal
- Per-module developer access
- Code commit interface (linked to GitHub)
- Feature flags (enable new features per company)
- Deployment pipeline (staging → production)
- Issue tracker / bug reports
- API documentation viewer

## 4. OS Updates
- Registry: register all new apps
- Desktop: add shortcuts
- KOBECARGO Payments tab → redirect to KobePay app

## 5. GitHub Push
- Commit and push all changes
