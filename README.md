# BidCraft — Backend

Node.js + Express + MongoDB backend for BidCraft (Agentic RFP responder). Uses Firebase Authentication (ID tokens) for auth, Multer for PDF uploads, Mongoose for data, and mock AI agents for proposal generation.

Quick start
1. Copy .env.example -> .env and set values:
   - MONGO_URI (e.g. mongodb://localhost:27017/bidcraft or Atlas URI)
   - PORT (optional, default 4000)
   - GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json (recommended) or set FIREBASE_SERVICE_ACCOUNT with JSON string
   - JWT_SECRET (kept for compatibility)
2. Place your Firebase service account JSON at project root as `serviceAccountKey.json`.
3. Install deps:
   yarn
4. Dev:
   yarn dev
   (or build + run: `yarn build && node dist/server.js`)

Health check
- GET / → { ok: true, service: 'BidCraft Backend' }

Auth (Firebase ID tokens)
- Verify token / get/create user:
  POST /api/auth/verify-token
  - Body JSON: { "idToken": "<FIREBASE_ID_TOKEN>" }
  - Response: { ok: true, user, firebase: decodedToken }

Protected routes: include header
Authorization: Bearer <ID_TOKEN>

Provider onboarding
- POST /api/provider/onboard
  - multipart/form-data: file (PDF)
  - Requires Authorization header

RFP ingestion
- POST /api/rfp/upload
  - multipart/form-data: file (PDF)
  - Returns created RFP document

Agent orchestration
- POST /api/bidcraft/run
  - JSON body: { rfpId: "<RFP_ID>", strategy: "default" }
  - Runs mock AI agents and saves generatedProposal to RFP

Dashboard
- GET /api/bidcraft/dashboard/stats
  - Returns totalBids, pendingApprovals, recent

Curl examples
- Verify Firebase ID token:
```
curl -X POST http://localhost:4000/api/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<ID_TOKEN>"}'
```

- Upload RFP (multipart):
```
curl -X POST http://localhost:4000/api/rfp/upload \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -F "file=@/path/to/rfp.pdf"
```

- Provider onboard (multipart):
```
curl -X POST http://localhost:4000/api/provider/onboard \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -F "file=@/path/to/provider_profile.pdf"
```

- Run agents:
```
curl -X POST http://localhost:4000/api/bidcraft/run \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"rfpId":"<RFP_ID>","strategy":"default"}'
```

- Dashboard:
```
curl -X GET http://localhost:4000/api/bidcraft/dashboard/stats \
  -H "Authorization: Bearer <ID_TOKEN>"
```

Postman collection
- Import `postman_collection.json` at project root to quickly test APIs.

Notes
- Keep `.env` and `serviceAccountKey.json` out of source control (already gitignored).
- Firebase tokens expire; client should refresh tokens as needed.

