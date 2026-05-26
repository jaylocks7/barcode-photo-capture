# Company I want to work for Catalog Capture — Project Spec

> This document is the source of truth for the Company I want to work for barcode → capture PWA. When working on this codebase, follow this spec exactly. Do not introduce features, patterns, libraries, or abstractions not described here without explicit instruction from the user.

---

## 1. Project context

A Progressive Web App that closes the loop in Company I want to work for's add-items flow. A user scans a CPG barcode in the field; the app checks a global catalog; if photos are needed, the user captures them and they are background-removed and stored. Built as a weekend MVP to demonstrate the workflow to Company I want to work for's Head of Integrations.

Deliverable: a deployed Vercel URL that can be demoed live or via Loom on an iPhone.

---

## 2. Working principles for code agents

Read this section before any task.

1. **Do not exceed v1 scope.** See Section 5. If a task seems to require an out-of-scope feature, stop and ask.
2. **Do not add tests unless explicitly requested.** v1 ships without an automated test suite.
3. **Do not add validation libraries** (zod, yup, joi). Use plain `if` checks.
4. **Do not add a state management library** (Redux, Zustand). `useState` and prop drilling are sufficient for this screen tree.
5. **Do not add a router library** for v1. The screen tree is shallow; use a single state variable in `<App>` to switch screens.
6. **Do not add error boundaries, retries, exponential backoff, or telemetry.** v1 happy-path only; a single `try/catch` around an API call with a generic "try again" toast is the ceiling.
7. **Do not split a file into smaller files for stylistic reasons.** Only split when the file exceeds ~250 lines or there is a genuine cohesion boundary.
8. **Do not modify the assumptions in Section 9** without asking. They are intentional simplifications.
9. **Use Node runtime** for all Vercel functions (`export const config = { runtime: 'nodejs' }`). The `redis` package requires Node.js TCP connections and is incompatible with Edge runtime.
10. **Match the existing code style** when editing files. If creating a new file, default to TypeScript strict mode, single quotes, no semicolons inside JSX expressions.

---

## 3. Stack (locked — do not substitute)

| Layer | Choice | Package(s) |
|---|---|---|
| Frontend framework | React 19 + Vite 6 | `react`, `react-dom`, `vite`, `@vitejs/plugin-react` |
| Language | TypeScript (strict) | `typescript` |
| Styling | Tailwind CSS v4 (Vite plugin) | `tailwindcss`, `@tailwindcss/vite` |
| Hosting | Vercel | (no package — connect repo) |
| Backend | Vercel serverless functions, Node runtime | (no package) |
| Data store | Redis (via `REDIS_URL` env var) | `redis` |
| Image storage | AWS S3 | `aws4fetch` (Edge-compatible SigV4 signer) |
| Barcode scan | ZXing (UPC_A, UPC_E, EAN_13, EAN_8) | `@zxing/browser`, `@zxing/library` |
| Camera capture | `getUserMedia` + `<video>` + `<canvas>` | (built-in) |
| Background removal | remove.bg API | (HTTP, no SDK) |
| External barcode lookup | Barcode Lookup API | (HTTP, no SDK) |
| Blur detection | Laplacian variance | (custom, no package) |

iOS Safari does not implement `BarcodeDetector` (confirmed on iOS 26). Use `@zxing/browser` with `DecodeHintType.POSSIBLE_FORMATS` set to `[UPC_A, UPC_E, EAN_13, EAN_8]` and `TRY_HARDER: true`.

---

## 4. Environment variables

All required. Set in Vercel project settings and in a local `.env` (gitignored).

| Name | Purpose |
|---|---|
| `APP_PASSWORD` | Single shared password for app access |
| `REDIS_URL` | Redis connection URL (e.g. `redis://...` or `rediss://...`) |
| `AWS_ACCESS_KEY_ID` | IAM user with `s3:PutObject` + `s3:GetObject` on the bucket |
| `AWS_SECRET_ACCESS_KEY` | (paired with above) |
| `AWS_REGION` | e.g. `us-west-2` |
| `S3_BUCKET` | Bucket name for image storage |
| `REMOVEBG_API_KEY` | remove.bg API key (free tier) |
| `BARCODE_API_KEY` | Barcode Lookup API key |

---

## 5. Scope

### 5.1 In scope (v1)

1. Single-password gate over all API routes via `x-app-password` header
2. `LoginScreen` that stores the password in `sessionStorage`
3. Barcode scanning via `BrowserMultiFormatReader` with rear camera
4. Manual barcode entry text input as fallback on `ScannerScreen`
5. `GET /api/items/:barcode` — checks Redis, falls back to Open Food Facts for the suggestion
6. `POST /api/items/:barcode/photos` — accepts multipart with `view`, `image`, optional `name`; calls remove.bg; uploads cutout to S3; updates KV
7. Three user flows (Section 8): existing+complete, existing+needs photos, new item
8. Photo capture per required view with client-side resize to max 1280px before send
9. Blur detection via Laplacian variance — blurry shots show a Retake-only overlay (no override)
10. Background removal via remove.bg, server-side
11. Preserve both raw and background-removed images in S3 (`{view}-raw.jpg` and `{view}-processed.png`) — both URLs stored on the item record
12. Success screen showing the cutout(s)

### 5.2 Out of scope (v1) — do not build these

- Per-user auth, identity, or roles (single shared password only)
- Re-capture or replace existing photos
- In-frame or framing validation
- Multi-angle pose guidance
- Foreground masking on-device
- Server-side quality gating beyond blur
- Offline capture queue
- Dedup against existing entries
- Bulk capture mode
- Animations beyond functional state transitions
- Error recovery beyond a generic "try again"
- Tests
- Search by item name
- Analytics, logging beyond `console.log`, monitoring
- Product category derivation from barcode scan
- Per-category photo requirements (all new items require `["front", "back"]` in v1)
- Confirmation pop-up for Case 1 (item in DB, needs photos): "Item is in DB, needs X photos — proceed?" with Yes/No. Yes routes to CaptureScreen, No returns focus to scanner.
- Confirmation pop-up for Case 3 (item not in DB): "Item not found — proceed to capture?" with Yes/No. Yes routes to CaptureScreen, No returns focus to scanner.
- Photo retake flow: (a) scanning a fully-complete item offers the option to recapture any view rather than just showing the banner; (b) during a partial capture session, cycle through already-captured views first and offer "Retake" or "Keep" before moving to the missing views.
- Additional photos beyond the two required views (e.g. detail shots, alternate angles) — v1 captures exactly `required_views` and no more.

---

## 6. Repository layout

Create files exactly at these paths. Do not invent new directories.

```
/
├── api/
│   ├── _lib/
│   │   ├── auth.ts                 # requireAuth(req) helper
│   │   ├── storage.ts              # Redis read/write + S3 upload via aws4fetch
│   │   └── external.ts             # Open Food Facts lookup + remove.bg call
│   └── items/
│       ├── [barcode].ts            # GET — lookup
│       └── [barcode]/
│           └── photos.ts           # POST — capture+process+store
├── src/
│   ├── App.tsx                     # screen router via single state var; manages barcode/item/pendingName useStates
│   ├── main.tsx
│   ├── index.css                   # contains: @import "tailwindcss";
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── ScannerScreen.tsx       # camera + ZXing reader + manual entry + inline "already complete" banner
│   │   ├── CaptureScreen.tsx       # viewfinder, shutter, blur warning overlay, processing overlay
│   │   └── SuccessScreen.tsx
│   ├── lib/
│   │   ├── api.ts                  # client API wrapper, attaches x-app-password
│   │   ├── blur.ts                 # Laplacian variance
│   │   └── resize.ts               # canvas resize to max 1280px
│   └── types.ts                    # ItemRecord, GetItemResponse, PostPhotoResponse
├── scripts/
│   └── seed.ts                     # one-off Redis seed runner
├── .env                            # gitignored
├── .gitignore
├── tsconfig.json
├── vite.config.ts                  # plugins: [react(), tailwindcss()]
├── package.json
└── README.md
```

---

## 7. Data model

```ts
// src/types.ts

export type View = 'front' | 'back';

export type ItemRecord = {
  barcode: string;
  name: string;
  needs_photos: boolean;            // derived at write time
  required_views: View[];           // any subset of ["front", "back"]
  photo_urls: Partial<Record<View, string>>;     // view -> processed (bg-removed) S3 URL
  raw_photo_urls: Partial<Record<View, string>>; // view -> raw (pre-processing) S3 URL
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601
};

export type GetItemResponse =
  | { exists: true; item: ItemRecord }
  | { exists: false; suggestion: { name: string } };

export type PostPhotoResponse = {
  processedUrl: string;
  item: ItemRecord;
};
```

Cross-screen state lives as three `useState` hooks in `<App>`:
- `barcode: string | null`
- `item: ItemRecord | null` — populated after first GET or POST response
- `pendingName: string | null` — set only when Case 3 routes to `CaptureScreen`; cleared after the first POST

`needs_photos` MUST be recomputed on every write:
```ts
needs_photos = required_views.some(v => !(v in photo_urls))
```

**Allowed views (v1):** `"front"`, `"back"`. No other view names. Server MUST reject any other value with 400.

**Default `required_views` for newly-created items:** `["front", "back"]`.

---

## 8. User flows

Three flows. The first GET response determines which flow runs.

### Case 1 — Entry exists, needs photos

Trigger: `GET /api/items/:barcode` → `{ exists: true, item: { needs_photos: true, ... } }`

```
1. Compute missing = required_views − keys(photo_urls)
2. For each view in missing:
   a. CaptureScreen shows: "{item.name} needs: {view}"
   b. User captures, blur check runs, user accepts or retakes
   c. POST /api/items/:barcode/photos { view, image }
   d. Replace local item with response.item
   e. Recompute missing
3. SuccessScreen: "{item.name} — catalog complete"
```

### Case 2 — Entry exists, complete

Trigger: `GET /api/items/:barcode` → `{ exists: true, item: { needs_photos: false, ... } }`

```
1. ScannerScreen shows an inline banner: "{item.name} — already in catalog ✓"
   (Banner sits above the scanner viewfinder; thumbnails of item.photo_urls — background-removed images only — shown below banner.)
2. Banner has a [Dismiss] button that clears it and returns focus to scanning.
3. No navigation; user stays on ScannerScreen.
```

**v1 note:** Banner is kept for the demo to make the "already complete" code path visible and to show off the bg-removed cutouts. **v2:** Replace with a subtle non-blocking indicator (e.g. haptic + brief toast) so the scanning flow isn't interrupted.

### Case 3 — Entry does not exist

Trigger: `GET /api/items/:barcode` → `{ exists: false, suggestion: { name: "..." } }`

```
1. Set pendingName state to suggestion.name in <App>
2. Skip directly to CaptureScreen (no intermediate screen)
3. First capture:
   POST /api/items/:barcode/photos { view: "front", image, name: pendingName }
   Server creates the item with required_views: ["front", "back"]
4. Clear pendingName after first successful POST
5. Continue capture loop as in Case 1
```

Cases 1 and 3 share the same capture loop after the first POST. Only difference: the first POST in Case 3 carries `name`; subsequent POSTs do not.

**Resilience design:** Each POST is independently atomic — it saves the photo to S3 and updates the Redis record before returning. If the sequence is interrupted mid-way (network partition, app crash, locked screen), already-captured views are preserved in Redis and S3. On rescan, `GET /api/items/:barcode` will return the partially-complete record and the capture loop picks up at the first missing view. For Case 3, the item record does not exist in Redis until the first POST succeeds — if the app crashes before that, the user simply rescans and gets the suggestion again with no lost work.

---

## 9. API contract

All routes use Vercel Node runtime. All routes call `requireAuth(req)` first.

### 9.1 GET `/api/items/:barcode`

**Request headers:** `x-app-password: <APP_PASSWORD>`

**Responses:**
```json
// 200 — exists in our catalog
{ "exists": true, "item": { /* ItemRecord */ } }

// 200 — not in our catalog, suggestion via Open Food Facts
{ "exists": false, "suggestion": { "name": "Pringles Original" } }

// 401 — missing or wrong password
{ "error": "unauthorized" }
```

### 9.2 POST `/api/items/:barcode/photos`

**Request headers:** `x-app-password: <APP_PASSWORD>`

**Request body:** `multipart/form-data` with fields:
- `view` (string, required) — one of `"front"`, `"back"`. Other values return 400.
- `image` (File, required) — JPEG, already resized to max 1280px by client
- `name` (string, optional) — required only when item does not yet exist
- `skipProcessing` (string `"true"`, optional) — skip remove.bg; stores raw as the processed placeholder. Used by the client on the first fast POST; a background re-POST without this flag triggers remove.bg.

**Responses:**
```json
// 200
{
  "processedUrl": "https://<bucket>.s3.amazonaws.com/items/<barcode>/<view>-processed.png",
  "item": { /* updated ItemRecord */ }
}

// 400 — missing name on new item, or invalid view value
{ "error": "name required for new item" }
{ "error": "view must be one of: front, back" }

// 401 — auth failure
{ "error": "unauthorized" }
```

---

## 10. Assumptions

These are intentional simplifications baked into v1. Do not silently work around them.

1. **The barcode lookup API always returns a name for any CPG barcode.** v1 uses Open Food Facts, which has imperfect coverage; the helper falls back to `"Unknown Item"` to keep the flow non-breaking. Production behind a paid commercial barcode API would never hit that fallback.
2. **Background-removed cutouts are the canonical image format.** Confirmed against Company I want to work for's existing catalog.
3. **The set of valid views is fixed: `"front"`, `"back"`.** All new items default to `["front", "back"]`. Top-view capture is deferred to v2 (remove.bg background removal for top-down shots is unreliable). Per-category view requirements is a v2 concern.
4. **A single shared password gates the app.** Single env var, validated per-request via `x-app-password` header. Per-user identity is v2.
5. **Redis represents the global item catalog.** In production this is Company I want to work for's actual DB.
6. **Single-tenant data model.** No venue-specific overrides on item records in v1.

---

## 11. Conventions

### 11.1 Auth

Every API route MUST call `requireAuth(req)` as its first action.

```ts
// api/_lib/auth.ts
import type { VercelRequest } from '@vercel/node'

export function requireAuth(req: VercelRequest): boolean {
  return req.headers['x-app-password'] === process.env.APP_PASSWORD
}
```

Usage:
```ts
if (!requireAuth(req)) return res.status(401).json({ error: 'unauthorized' })
```

### 11.2 Client API wrapper

All frontend API calls go through `src/lib/api.ts`. Do not call `fetch` directly from components. `postPhoto` takes an options object `{ processedImage?, name?, skipProcessing? }` — see §9.2 for the `skipProcessing` two-POST pattern.

### 11.3 External barcode lookup

`lookupExternalProduct(barcode)` in `api/_lib/external.ts` hits the Barcode Lookup API and falls back to `"Unknown Item"` on any error.

### 11.4 remove.bg call

`callRemoveBg(imageBytes)` in `api/_lib/external.ts` POSTs the JPEG bytes to `https://api.remove.bg/v1.0/removebg` and returns the PNG `ArrayBuffer`. The client captures as JPEG (`resize.ts`, quality 0.85); raw JPEG is stored as `{view}-raw.jpg`, processed PNG as `{view}-processed.png`.

### 11.5 Storage (Redis + S3)

`api/_lib/storage.ts` exports `getItem`, `setItem`, and `uploadToS3`. Redis client and AWS client are lazily initialised (`getRedis()` / `getAws()`) so cold-start connections don't fail. `setItem`/`getItem` manually `JSON.stringify`/`JSON.parse` because node-redis stores strings.

### 11.6 S3 CORS configuration

The S3 bucket MUST have this CORS config:

```json
[
  {
    "AllowedOrigins": ["https://*.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### 11.7 Naming

- Screens: PascalCase, one per file, default export.
- Helper modules under `api/_lib/` and `src/lib/`: camelCase functions, named exports.
- Files match the primary export name (`CaptureScreen.tsx` exports `CaptureScreen`).

---

## 12. Demo seed data

Populated by `scripts/seed.ts` into Redis.

| Barcode | Name | required_views | photo_urls state | raw_photo_urls state | Demo role |
|---|---|---|---|---|---|
| `096619926626` | Kirkland Fish Oil 1000mg | `["front", "back"]` | front filled, back empty | front filled, back empty | Demo flow #1 — needs some |
| `016500558415` | One A Day Mens Multivitamin | `["front", "back"]` | all filled | all filled | Case 2 — already complete, shows inline banner |

For seeded items with filled `photo_urls`/`raw_photo_urls`, use any reachable placeholder image URL. The actual image content does not matter for the demo, only that the URLs render in the KV dashboard view.

For demo flow #2 (new item / Case 3), scan a real product whose barcode is NOT in the seed data. Verify it exists in the Barcode Lookup API before recording.

---

## 13. Demo script (Loom recording path)

Exactly four steps. Total target length: 2–3 minutes.

### Step 1 — Login + needs some photos (Kirkland Fish Oil, partial)
1. Open Vercel URL on iPhone, enter password → ScannerScreen
2. Scan Kirkland Fish Oil (`096619926626`) → server returns item with front filled, back empty → app routes to CaptureScreen with `remainingViews = ["back"]`
3. **Showcase blur rejection here:** deliberately shaky/out-of-focus shot → blur-warning overlay appears → tap Retake → clean shot → "Uploading…" overlay → response
4. SuccessScreen auto-dismisses after 2 seconds → back to ScannerScreen

### Step 2 — Unknown item, Barcode Lookup API resolves name (case 3)
1. Scan a real product whose barcode is NOT in seed data → server returns `{ exists: false, suggestion: { name: "..." } }`
2. App routes directly to CaptureScreen with `pendingName` set; user does NOT see a name input screen
3. Capture front (first POST carries `name: pendingName`; server creates the record with `required_views: ["front", "back"]`) → Processing → Capture back → Processing
4. SuccessScreen shows both cutouts, auto-dismisses after 2 seconds

### Step 3 — Already complete (One A Day, case 2)
1. Scan One A Day Multivitamin (`016500558415`) → inline banner appears on ScannerScreen with item name + photo thumbnails
2. Tap [Dismiss] → banner clears, scanner stays active

### Step 4 — Show off the DB
1. Open the Redis console in a browser tab
2. Open the record for the item created in Step 2 — show the JSON: `name`, `required_views`, `photo_urls`, `raw_photo_urls`, timestamps
3. Click an S3 URL to open in a new tab. Show the raw JPEG and the bg-removed PNG side by side — emphasize the before/after as the visual payoff

---

## 14. Anti-patterns (do NOT do these)

- Do NOT introduce view names other than `"front"`, `"back"` in v1. The set is fixed; the `View` type in `src/types.ts` is the source of truth.
- Do NOT use `localStorage` for the password (use `sessionStorage` — clears on tab close).
- Do NOT serialize/parse the image bytes through the function as JSON or base64. Use multipart `Request.formData()`.
- Do NOT call remove.bg from the client (would expose the API key).
- Do NOT import `@aws-sdk/*` packages anywhere. They use Node `Buffer` and break in Edge runtime. Use `aws4fetch` exclusively for S3 access.
- Do NOT add a `/api/auth` endpoint. Auth is per-request via header, not session-based.
- Do NOT use Edge runtime for any Vercel function. All routes use Node runtime (`export const config = { runtime: 'nodejs' }`). The `redis` package requires Node TCP and is incompatible with Edge.
- Do NOT introduce React Router. Use a `currentScreen` state variable in `<App>`.
- Do NOT store ONLY the processed cutout. Raw (pre-processing) image MUST also be persisted to S3 under `{view}-raw.jpg` and its URL stored in `raw_photo_urls[view]`. This supports the demo's "show off the DB" step and provides an audit trail.
- Do NOT compute `needs_photos` at read time. Always derived and persisted at write time.
- Do NOT add upload progress indicators, retry buttons, or offline detection in v1.
- Do NOT auto-advance from the blur-warning overlay. The user must tap Retake. There is no "Use Anyway" option.
- Do NOT use the same camera stream for `Scanner` and `Capture`. Each screen owns its own `getUserMedia` lifecycle and releases the stream on unmount.

---

## 15. Troubleshooting / known gotchas

- **iOS Safari camera fails with `NotAllowedError`** — site must be HTTPS. Vercel preview URLs satisfy this; `localhost` does not.
- **Multipart form parsing issues** — confirm the route exports `export const config = { runtime: 'nodejs' }` and uses `busboy` or `formidable` to parse the body; `req.body` is not automatically parsed for multipart.
- **S3 PUT returns CORS error** — bucket CORS must include the Vercel domain and `localhost:5173`; see Section 10.6.
- **Vercel function body size > 4.5 MB** — client-side resize is mandatory; max dimension 1280px keeps JPEG well under 1 MB.
- **remove.bg returns 402** — free tier exhausted (50/month). Use the same input for repeated dev tests; remove.bg may charge once per unique image.
- **ZXing slow to decode** — provide `DecodeHintType.POSSIBLE_FORMATS` with only the four retail formats; do not request all formats.
- **`BarcodeDetector` returns undefined on iPhone** — expected. iOS Safari does not implement it; use ZXing.

---

## 16. General coding guidelines

> Behavioral guidelines to reduce common LLM coding mistakes. These bias toward caution over speed — use judgment on trivial tasks.

### 16.1 Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 16.2 Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 16.3 Surgical changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### 16.4 Goal-driven execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan before starting:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria allow independent looping. Weak criteria ("make it work") require constant clarification.
