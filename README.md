# byteArchieve

Public file archive. Anyone can browse and download. Uploading needs an account. Every upload sits in a review queue until the admin approves it.

- **client/** React + Vite
- **server/** Express, Neon (Postgres), Cloudflare R2 (S3 API, presigned URLs)

## How it works

| Who | Can do |
| --- | --- |
| Anyone | Browse, search, download **approved** files |
| Registered user | Upload (goes to `pending`), see own uploads + status, delete own |
| Admin | Preview pending files, approve / reject (with note), delete, suspend users |

Upload flow: client asks the API for a presigned PUT URL, uploads straight to R2, then confirms. The API checks the object exists with the right size before marking it `pending`. File bytes never pass through Express.

## Setup

### 1. Neon
Create a project, copy the connection string into `server/.env` as `DATABASE_URL`.

### 2. R2
1. Create a bucket (keep it private).
2. Create an **API token** with Object Read & Write on that bucket. Put the account id, key id and secret in `server/.env`.
3. Bucket **Settings → CORS policy** (needed for browser uploads):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://your-frontend.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3. Server
```bash
cd server
cp .env.example .env      # fill it in
npm install
npm run migrate           # creates tables
npm run seed:admin        # creates the admin from ADMIN_USERNAME / ADMIN_PASSWORD
npm run dev               # http://localhost:4000
```

### 4. Client
```bash
cd client
npm install
npm run dev               # http://localhost:5173 (proxies /api to :4000)
```
In production set `VITE_API_URL` to the API origin and add the frontend origin to `CLIENT_ORIGIN` on the server.

## API

```
POST /api/auth/register | /login      GET /api/auth/me
GET  /api/files?q=&page=              approved files (public)
GET  /api/files/mine                  own uploads
POST /api/files/upload-url            -> { id, url }
POST /api/files/:id/confirm
GET  /api/files/:id/download          302 to a 5-minute signed URL (approved only)
GET  /api/files/:id/link              same, JSON; owner/admin can fetch non-approved
DELETE /api/files/:id                 own file
GET  /api/admin/stats | /files?status= | /users
PATCH /api/admin/files/:id            { status, note }
DELETE /api/admin/files/:id
PATCH /api/admin/users/:id            { banned }
```

## Notes
- Auth is JWT (7 days) in `localStorage`; passwords are bcrypt-hashed. No email flow.
- Auth routes are rate-limited (30 / 15 min per IP).
- Approving a file does not scan its contents. Review before approving.
- Design: Figma file "byteArchieve" (tokens, components, Browse / Upload / Admin screens).
