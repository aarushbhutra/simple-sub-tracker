# simple sub tracker

private subscription tracker for one user, built for netlify.

## features

- single-user app lock with secure http-only session cookie
- encrypted subscription storage in netlify blobs (aes-256-gcm)
- tracks name, amount, currency (usd/gbp/inr), monthly/bi-monthly/annual cycle, start date, remarks
- summary metrics:
  - monthly equivalent total in inr
  - annual projection in inr
  - native monthly totals by currency
  - next upcoming charge
- import/export json backups
- cream lowercase ui, mobile-friendly

## stack

- react + vite frontend
- netlify functions api (`/api/auth`, `/api/subscriptions`)
- netlify blobs for serverless private storage

## local setup

1. install dependencies

```bash
npm install
```

2. copy env template and set secrets

```bash
cp .env.example .env
```

required variables:

- `APP_LOGIN_PASSWORD`: strong password you use to unlock app
- `SESSION_SECRET`: long random secret for signing session cookies
- `APP_ENCRYPTION_KEY`: 32-byte base64 string (or a long random secret)
- `NETLIFY_BLOB_STORE`: blob store name (default already set)

3. run dev

```bash
npm run dev
```

## deploy to netlify

1. connect this repo in netlify.
2. add env vars above in site settings.
3. deploy.

## optional extra netlify basic-auth gate

this repo includes `public/_headers` with:

```txt
/*
  Basic-Auth: youruser:replace-with-very-strong-password
```

replace with your own credentials before production deploy.

note: if your plan does not enforce custom basic-auth headers, keep app lock enabled (already built-in here) and enable netlify dashboard password protection when available.

## api behavior

- `POST /api/auth` body `{ password }` to login
- `GET /api/auth?action=session` to verify session
- `DELETE /api/auth` logout
- `GET /api/subscriptions` list + summary
- `POST /api/subscriptions` add
- `PATCH /api/subscriptions?id=...` update
- `DELETE /api/subscriptions?id=...` delete
- `PUT /api/subscriptions` replace all (import)

all subscription payloads are validated server-side and encrypted before persistence.
