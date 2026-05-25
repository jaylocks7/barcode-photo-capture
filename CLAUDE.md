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
8. **Do not modify the assumptions in Section 10** without asking. They are intentional simplifications.
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
| Barcode scan | ZXing | `@zxing/browser`, `@zxing/library` |
| Camera capture | `getUserMedia` + `<video>` + `<canvas>` | (built-in) |
| Background removal | remove.bg API | (HTTP, no SDK) |
| External barcode lookup | Barcode Lookup API | (HTTP, no SDK) |
| Blur detection | Laplacian variance | (custom, no package) |

iOS Safari does not implement `BarcodeDetector` (confirmed on iOS 26). Use `@zxing/browser`.

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

### 5.1 In scope (v1) — build these, in this order

1. Single-password gate over all API routes via `x-app-password` header
2. `LoginScreen` that stores the password in `sessionStorage`
3. Barcode scanning via `BrowserMultiFormatReader` with rear camera
4. Manual barcode entry text input as fallback on `ScannerScreen`
5. `GET /api/items/:barcode` — checks Redis, falls back to Open Food Facts for the suggestion
6. `POST /api/items/:barcode/photos` — accepts multipart with `view`, `image`, optional `name`; calls remove.bg; uploads cutout to S3; updates KV
7. Three user flows (Section 8): existing+complete, existing+needs photos, new item
8. Photo capture per required view with client-side resize to max 1280px before send
9. Blur detection via Laplacian variance, with user override
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
- Per-category photo requirements (all new items require `["front", "back", "top"]` in v1)
- Confirmation pop-up for Case 1 (item in DB, needs photos): "Item is in DB, needs X photos — proceed?" with Yes/No. Yes routes to CaptureScreen, No returns focus to scanner.
- Confirmation pop-up for Case 3 (item not in DB): "Item not found — proceed to capture?" with Yes/No. Yes routes to CaptureScreen, No returns focus to scanner.

---

## 6. Repository layout

Create files exactly at these paths. Do not invent new directories.

```
mvp/
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
├── .env.local                      # gitignored
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

export type View = 'front' | 'back' | 'top';

export type ItemRecord = {
  barcode: string;
  name: string;
  needs_photos: boolean;            // derived at write time
  required_views: View[];           // any subset of ["front", "back", "top"]
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

**Allowed views (v1):** `"front"`, `"back"`, `"top"`. No other view names. Server MUST reject any other value with 400.

**Default `required_views` for newly-created items:** `["front", "back", "top"]`.

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
   Server creates the item with required_views: ["front", "back", "top"]
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

**Handler logic:**
```
1. requireAuth(req); on fail return 401
2. const item = await kv.get<ItemRecord>(`item:${barcode}`)
3. if (item) return { exists: true, item }
4. const suggestion = await lookupExternalProduct(barcode)
5. return { exists: false, suggestion }
```

### 9.2 POST `/api/items/:barcode/photos`

**Request headers:** `x-app-password: <APP_PASSWORD>`

**Request body:** `multipart/form-data` with fields:
- `view` (string, required) — one of `"front"`, `"back"`, `"top"`. Other values return 400.
- `image` (File, required) — JPEG, already resized to max 1280px by client
- `name` (string, optional) — required only when item does not yet exist

**Responses:**
```json
// 200
{
  "processedUrl": "https://<bucket>.s3.amazonaws.com/items/<barcode>/<view>-processed.png",
  "item": { /* updated ItemRecord */ }
}

// 400 — missing name on new item, or invalid view value
{ "error": "name required for new item" }
{ "error": "view must be one of: front, back, top" }

// 401 — auth failure
{ "error": "unauthorized" }
```

**Handler logic:**
```
1. requireAuth(req); on fail return 401
2. const form = await req.formData()
3. const view = form.get('view') as string
4. if (!['front', 'back', 'top'].includes(view)) return 400
5. const image = form.get('image') as File
6. const name = form.get('name') as string | null
7. let item = await kv.get<ItemRecord>(`item:${barcode}`)
8. if (!item) {
     if (!name) return 400
     item = newItemRecord({ barcode, name })  // required_views = ["front", "back", "top"]
   }
9. const imageBuffer = await image.arrayBuffer()
10. const rawUrl = await uploadToS3({
      key: `items/${barcode}/${view}-raw.jpg`,
      body: imageBuffer,
      contentType: 'image/jpeg'
    })
11. const cutoutBuffer = await callRemoveBg(imageBuffer)
12. const processedUrl = await uploadToS3({
      key: `items/${barcode}/${view}-processed.png`,
      body: cutoutBuffer,
      contentType: 'image/png'
    })
13. item.raw_photo_urls[view] = rawUrl
14. item.photo_urls[view] = processedUrl
15. item.needs_photos = item.required_views.some(v => !(v in item.photo_urls))
16. item.updated_at = new Date().toISOString()
17. await kv.set(`item:${barcode}`, item)
18. return { processedUrl, item }
```

---

## 10. Assumptions

These are intentional simplifications baked into v1. Do not silently work around them.

1. **The barcode lookup API always returns a name for any CPG barcode.** v1 uses Open Food Facts, which has imperfect coverage; the helper falls back to `"Unknown Item"` to keep the flow non-breaking. Production behind a paid commercial barcode API would never hit that fallback.
2. **Background-removed cutouts are the canonical image format.** Confirmed against Company I want to work for's existing catalog.
3. **The set of valid views is fixed: `"front"`, `"back"`, `"top"`.** All new items default to `["front", "back", "top"]`. Per-category view requirements is a v2 concern.
4. **A single shared password gates the app.** Single env var, validated per-request via `x-app-password` header. Per-user identity is v2.
5. **Redis represents the global item catalog.** In production this is Company I want to work for's actual DB.
6. **Single-tenant data model.** No venue-specific overrides on item records in v1.

---

## 11. Conventions

### 11.1 Auth

Every API route MUST call `requireAuth(req)` as its first action.

```ts
// api/_lib/auth.ts
export function requireAuth(req: Request): Response | null {
  const provided = req.headers.get('x-app-password');
  if (provided !== process.env.APP_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return null;
}
```

Usage:
```ts
const unauthorized = requireAuth(req);
if (unauthorized) return unauthorized;
```

### 11.2 Client API wrapper

All frontend API calls go through `src/lib/api.ts`. Do not call `fetch` directly from components.

```ts
// src/lib/api.ts
function authHeader(): Record<string, string> {
  const password = sessionStorage.getItem('app_password') || '';
  return { 'x-app-password': password };
}

export async function getItem(barcode: string): Promise<GetItemResponse> {
  const res = await fetch(`/api/items/${encodeURIComponent(barcode)}`, {
    headers: authHeader(),
  });
  if (res.status === 401) {
    sessionStorage.removeItem('app_password');
    window.location.reload();
  }
  return res.json();
}

export async function postPhoto(
  barcode: string,
  view: string,
  image: Blob,
  name?: string
): Promise<PostPhotoResponse> {
  const form = new FormData();
  form.append('view', view);
  form.append('image', image, `${view}.jpg`);
  if (name) form.append('name', name);
  const res = await fetch(`/api/items/${encodeURIComponent(barcode)}/photos`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  return res.json();
}
```

### 11.3 External barcode lookup

```ts
// api/_lib/external.ts (part 1 of 2 — see Section 11.4 for remove.bg)
export async function lookupExternalProduct(barcode: string): Promise<{ name: string }> {
  try {
    const res = await fetch(
      `https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=${process.env.BARCODE_API_KEY}`
    );
    const data = await res.json();
    if (data.products?.[0]?.title) {
      return { name: data.products[0].title as string };
    }
  } catch {
    // fall through to default
  }
  return { name: 'Unknown Item' };
}
```

### 11.4 remove.bg call (also in `api/_lib/external.ts`)

**Image format pipeline:** The captured frame is converted to JPEG on the client (via `canvas.toBlob(..., 'image/jpeg', 0.85)` in `resize.ts`) before upload. The JPEG bytes are sent as-is to remove.bg and also stored as the raw image in S3 (`{view}-raw.jpg`, `contentType: 'image/jpeg'`). The processed cutout returned by remove.bg is a PNG and is stored separately (`{view}-processed.png`).

```ts
// api/_lib/external.ts (part 2 of 2)
export async function callRemoveBg(imageBytes: ArrayBuffer): Promise<ArrayBuffer> {
  const form = new FormData();
  form.append('image_file', new Blob([imageBytes], { type: 'image/jpeg' }), 'capture.jpg');
  form.append('size', 'auto');
  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY! },
    body: form,
  });
  if (!res.ok) throw new Error(`remove.bg failed: ${res.status}`);
  return await res.arrayBuffer();
}
```

### 11.5 Storage (Redis + S3 via aws4fetch)

```ts
// api/_lib/storage.ts
import { createClient } from 'redis';
import { AwsClient } from 'aws4fetch';
import type { ItemRecord } from '../../src/types';

const redis = await createClient({ url: process.env.REDIS_URL }).connect();

const aws = new AwsClient({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
  service: 's3',
});

export const itemKey = (barcode: string) => `item:${barcode}`;

export async function getItem(barcode: string): Promise<ItemRecord | null> {
  const val = await redis.get(itemKey(barcode));
  return val ? JSON.parse(val) as ItemRecord : null;
}

export async function setItem(item: ItemRecord): Promise<void> {
  await redis.set(itemKey(item.barcode), JSON.stringify(item));
}

export async function uploadToS3(params: {
  key: string;
  body: ArrayBuffer | Uint8Array;
  contentType: string;
}): Promise<string> {
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.AWS_REGION!;
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${params.key}`;
  const res = await aws.fetch(url, {
    method: 'PUT',
    body: params.body,
    headers: { 'Content-Type': params.contentType },
  });
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status}`);
  return url;
}
```

`redis` (node-redis) stores strings, so `setItem`/`getItem` must manually `JSON.stringify`/`JSON.parse` the `ItemRecord`.

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

## 12. Implementation order

Execute tasks sequentially. Each task lists files touched and a success criterion. Do not start a task until the previous one's success criterion is met.

### Task 1 — Project scaffold and deploy
**Files:** repo root via `npm create vite@latest`
**Do:** init Vite React TS, install deps, push to GitHub, connect Vercel.
**Success:** default Vite page loads at the Vercel preview URL on an iPhone over HTTPS.

### Task 2 — Tailwind v4 setup
**Files:** `vite.config.ts`, `src/index.css`, `package.json`
**Do:**
- `npm install -D tailwindcss @tailwindcss/vite`
- Add `tailwindcss()` to the `plugins` array in `vite.config.ts`
- In `src/index.css`, replace any existing content with: `@import "tailwindcss";`
- Do NOT create `tailwind.config.js` or `postcss.config.js`. Tailwind v4 does not require them by default. If theme customization is needed later, use the `@theme` directive inside `index.css`.
**Success:** a Tailwind utility class on the default page (e.g. `<h1 className="text-3xl font-bold underline">`) renders as expected.

### Task 3 — Env vars and Redis
**Files:** Vercel dashboard, `.env`
**Do:**
- Add `REDIS_URL` plus the remaining env vars (`APP_PASSWORD`, AWS keys, `S3_BUCKET`, `REMOVEBG_API_KEY`) to both Vercel project settings and `.env`.
- Run `vercel env pull .env.local` (after `npm i -g vercel` and `vercel link`) to pull all env vars locally.
- Install client: `npm install redis`
**Success:** a one-off `tsx` script can `import { createClient } from 'redis'` and read/write a test key via `REDIS_URL`.

### Task 4 — Auth helper
**Files:** `api/_lib/auth.ts`
**Do:** implement `requireAuth` per Section 11.1.
**Success:** importable from a placeholder API route.

### Task 5 — Helper modules
**Files:** `api/_lib/external.ts`, `api/_lib/storage.ts`
**Do:**
- `npm install redis aws4fetch`
- Implement per Section 11.3, 11.4, 11.5.
**Success:** each importable with no runtime error. Quick sanity: a one-off `tsx` script calls `lookupExternalProduct('038000138416')` and gets back a name.

### Task 6 — GET endpoint
**Files:** `api/items/[barcode].ts`
**Do:** Node runtime, implement per Section 9.1.
**Success:**
- `curl -H "x-app-password: <pw>" .../api/items/038000138416` returns `{ exists: false, suggestion: {...} }`
- Same curl with wrong header returns 401.

### Task 7 — POST endpoint
**Files:** `api/items/[barcode]/photos.ts`
**Do:** Node runtime, implement per Section 9.2.
**Success:** `curl -F view=front -F image=@test.jpg -F name="Test Item" -H "x-app-password: <pw>" .../api/items/123/photos` returns a `processedUrl`; KV record contains both `photo_urls.front` and `raw_photo_urls.front`; S3 contains both `items/123/front-raw.jpg` and `items/123/front-processed.png`.

### Task 8 — Seed script
**Files:** `scripts/seed.ts`
**Do:** populate KV with the three seed entries from Section 13.
**Success:** running `tsx scripts/seed.ts` then `curl` GET against each seeded barcode returns the expected `ItemRecord` with both `photo_urls` and `raw_photo_urls` fields present (filled or empty per the table).

### Task 9 — LoginScreen + App shell
**Files:** `src/App.tsx`, `src/screens/LoginScreen.tsx`, `src/lib/api.ts`, `src/types.ts`
**Do:** implement password gate using `sessionStorage`. `<App>` declares three `useState` hooks (`barcode`, `item`, `pendingName`) and a `currentScreen` state. Shows `<LoginScreen>` if no password, else `<ScannerScreen>`.
**Success:** entering the correct password reveals an empty `<ScannerScreen>` placeholder; wrong password shows an error.

### Task 10 — ScannerScreen (inline scanner + manual entry + already-complete banner)
**Files:** `src/screens/ScannerScreen.tsx`
**Do:** rear-camera live scan via `BrowserMultiFormatReader`, format hints `EAN_13, EAN_8, UPC_A, UPC_E`. Include a manual barcode input below the video element. On detection or manual submit, call `getItem` and branch in the parent `<App>`. If response is `{ exists: true, needs_photos: false }`, render an inline banner above the viewfinder with item name, thumbnails of `photo_urls`, and a [Dismiss] button — do not navigate away.
**Success:** scanning each of the three seeded barcodes routes correctly: Lay's → CaptureScreen, Pringles → CaptureScreen, Coke → banner shown inline.

### Task 11 — Two-way branch after lookup
**Files:** `src/App.tsx`
**Do:** after `getItem`:
- `{ exists: true, item: { needs_photos: false } }` → set state to show inline banner on `ScannerScreen` (no navigation)
- `{ exists: true, item: { needs_photos: true } }` → set `item` state, navigate to `CaptureScreen`
- `{ exists: false, suggestion }` → set `pendingName` to `suggestion.name`, navigate to `CaptureScreen`
**Success:** all three seeded barcodes produce the correct screen state.

### Task 12 — CaptureScreen (viewfinder, resize, blur check, processing overlay)
**Files:** `src/screens/CaptureScreen.tsx`, `src/lib/resize.ts`, `src/lib/blur.ts`
**Do:**
- Rear-camera `<video>`, shutter button captures to `<canvas>`.
- `resize.ts` produces a JPEG Blob, max dimension 1280px, quality 0.85.
- `blur.ts` computes Laplacian variance over a grayscale-downsampled copy; threshold ~100 (tune with test shots).
- If variance below threshold, render an inline overlay with `Retake` / `Use anyway` buttons — never hard-block.
- On accept, call `postPhoto`; render an inline "Removing background…" overlay until response.
- After response, update `item` state in `<App>`, clear `pendingName` if set, recompute missing views.
- Loop until no missing views, then navigate to `SuccessScreen`.
**Success:** Lay's seed item: capture back (one view), reach SuccessScreen. Pringles seed item: capture front, back, top, reach SuccessScreen.

### Task 13 — SuccessScreen
**Files:** `src/screens/SuccessScreen.tsx`
**Do:** show "{item.name} — added to catalog ✓" or "catalog complete ✓" depending on whether this was a new item (had `pendingName` initially) or an existing item; render thumbnails of all `photo_urls`. Include a [Scan another] button that resets `barcode`/`item`/`pendingName` state and returns to `ScannerScreen`.
**Success:** visually correct on iPhone after both demo capture flows.

### Task 14 — Polish + iOS Safari fixes
**Files:** as needed
**Do:** address iPhone-specific issues found during testing (orientation, permission re-prompt after lock, video element sizing).
**Success:** full demo script (Section 14) runs end-to-end without intervention.

---

## 13. Demo seed data

Populated by `scripts/seed.ts` into Redis.

| Barcode | Name | required_views | photo_urls state | raw_photo_urls state | Demo role |
|---|---|---|---|---|---|
| `028400090307` | Lay's Classic Chips | `["front", "back"]` | front filled, back empty | front filled, back empty | Demo flow #1 — needs some |
| `038000138416` | Pringles Original | `["front", "back", "top"]` | all empty | all empty | Demo flow #2 — needs all |
| `012345678905` | Coca-Cola Can 12oz | `["front", "back"]` | both filled | both filled | NOT used in demo; kept so case 2 code path remains testable during build |

For seeded items with filled `photo_urls`/`raw_photo_urls`, use any reachable placeholder image URL. The actual image content does not matter for the demo, only that the URLs render in the KV dashboard view.

For demo flow #3, the developer scans a real product whose barcode is NOT in the seed data. Pick a packaged snack/beverage in the recording environment that exists in Open Food Facts. Verify before recording by hitting `https://world.openfoodfacts.org/api/v0/product/<barcode>.json` and confirming `status === 1`.

---

## 14. Demo script (Loom recording path)

Exactly four steps. Total target length: 2–3 minutes.

### Step 1 — Login + needs some photos (Lay's, partial)
1. Open Vercel URL on iPhone, enter password → ScannerScreen
2. Scan Lay's (`028400090307`) → server returns item with front filled, back empty → app routes to CaptureScreen with `remainingViews = ["back"]`
3. **Showcase blur rejection here:** deliberately shaky/out-of-focus shot of the back → blur-warning overlay appears → tap Retake → clean back shot → "Removing background…" overlay → response
4. Land on SuccessScreen with the back cutout

### Step 2 — Needs all photos (Pringles, empty)
1. Tap [Scan another] → ScannerScreen
2. Scan Pringles (`038000138416`) → server returns item with all three views empty → CaptureScreen with `remainingViews = ["front", "back", "top"]`
3. Capture front → Processing → Capture back → Processing → Capture top → Processing
4. Land on SuccessScreen with all three cutouts

### Step 3 — Unknown item, Open Food Facts resolves name (case 3)
1. Tap [Scan another] → ScannerScreen
2. Scan a real product whose barcode is NOT in seed data (pre-verified in OFF) → server returns `{ exists: false, suggestion: { name: "..." } }`
3. App routes directly to CaptureScreen with `pendingName` set; user does NOT see a name input screen
4. Capture front (first POST carries `name: pendingName`; server creates the record with `required_views: ["front", "back", "top"]`) → Processing → Capture back → Processing → Capture top → Processing
5. Land on SuccessScreen with both cutouts and the auto-resolved name

### Step 4 — Show off the DB
1. Open the Redis console in a browser tab
2. Open the record for the item just created in Step 3 — show the JSON: `name`, `required_views`, `photo_urls`, `raw_photo_urls`, timestamps
3. Click each S3 URL to open the image in a new tab. For at least one view, show the raw image and the bg-removed processed image side by side — emphasize the before/after as the visual payoff
4. Optional: also navigate to Pringles or Lay's record to show multiple views populated

---

## 15. Anti-patterns (do NOT do these)

- Do NOT introduce view names other than `"front"`, `"back"`, `"top"` in v1. The set is fixed; the `View` type in `src/types.ts` is the source of truth.
- Do NOT use `localStorage` for the password (use `sessionStorage` — clears on tab close).
- Do NOT serialize/parse the image bytes through the function as JSON or base64. Use multipart `Request.formData()`.
- Do NOT call remove.bg from the client (would expose the API key).
- Do NOT import `@aws-sdk/*` packages anywhere. They use Node `Buffer` and break in Edge runtime. Use `aws4fetch` exclusively for S3 access.
- Do NOT add a `/api/auth` endpoint. Auth is per-request via header, not session-based.
- Do NOT use Node runtime for the photo POST endpoint unless Edge cannot satisfy a constraint. Edge `Request.formData()` removes the need for `formidable`/`busboy`.
- Do NOT introduce React Router. Use a `currentScreen` state variable in `<App>`.
- Do NOT store ONLY the processed cutout. Raw (pre-processing) image MUST also be persisted to S3 under `{view}-raw.jpg` and its URL stored in `raw_photo_urls[view]`. This supports the demo's "show off the DB" step and provides an audit trail.
- Do NOT compute `needs_photos` at read time. Always derived and persisted at write time.
- Do NOT add upload progress indicators, retry buttons, or offline detection in v1.
- Do NOT auto-advance from the blur-warning overlay. The user must tap Retake or Use Anyway.
- Do NOT use the same camera stream for `Scanner` and `Capture`. Each screen owns its own `getUserMedia` lifecycle and releases the stream on unmount.

---

## 16. Troubleshooting / known gotchas

- **iOS Safari camera fails with `NotAllowedError`** — site must be HTTPS. Vercel preview URLs satisfy this; `localhost` does not.
- **`Request.formData()` undefined** — confirm the route exports `export const config = { runtime: 'edge' }`.
- **S3 PUT returns CORS error** — bucket CORS must include the Vercel domain and `localhost:5173`; see Section 11.7.
- **Vercel function body size > 4.5 MB** — client-side resize is mandatory; max dimension 1280px keeps JPEG well under 1 MB.
- **remove.bg returns 402** — free tier exhausted (50/month). Use the same input for repeated dev tests; remove.bg may charge once per unique image.
- **ZXing slow to decode** — provide `DecodeHintType.POSSIBLE_FORMATS` with only the four retail formats; do not request all formats.
- **`BarcodeDetector` returns undefined on iPhone** — expected. iOS Safari does not implement it; use ZXing.
