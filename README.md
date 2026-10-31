# kohulabs-android

**Kō**, the Android app for the Kohu Labs founder, João Duarte. **Kō runs the day, you do the chunks.** Built from the
Claude Design project "Kohu Founders App" (file "Ko Phone"). Kō plans the day in 25 minute chunks across four tabs
(General, Kohu with MCP tools, Personal and Revolut fed by you). Home is Kō roaming the screen until you tap him; then
Focus, Today, Day map, the focus guard, the day review, meeting prep and follow-up, follow-ups, Kō's chat and voice,
alarms with a morning brief, the lock-screen wake-up, Stats and OpenRouter spend, MCP servers and Settings, in EN
and PT.

Kept apart from the Kohu Labs website and client portal (the KohuLabs repository): its own code, Worker, database
and secrets.

## Repository layout

```
android/      the Android app (Kotlin): WebView shell, phone features, the database on the phone, sync
web/          the app's screens (web/founders/), plus the files they use: Kō's renderer (js/signal.js), fonts, icons
api/          the Cloudflare Worker (android.kohulabs.com): Google sign-in for the app, and the cloud copy (D1)
db/           the data model: migrations/ (the cloud's tables) and check-schema.mjs
tests/        browser tests for the screens (Playwright)
wrangler.jsonc  the Worker's Cloudflare config
```

## The app (`android/`)

A Kotlin project (Android 8.0 and up, targets Android 16). Its one screen is a WebView showing `web/founders/`,
copied into the APK's assets on every build and served from the APK, so the app works offline. The Android side adds
what a page can't do:

- **Edge to edge:** dark system bars; the app is kept clear of the status bar, navigation bar, cutouts and keyboard.
- **Back button:** steps back through the screens (sheets, sub-screens, then Kō's home), then leaves the app.
- **Alarms:** when Kō sets an alarm ("Wake me at 06:45 for a run"), it is also set in the phone's Clock app.
- **Your data:** a database on the phone (below), and Google sign-in and syncing with the cloud copy.
- An adaptive launcher icon from the Kohu mark; no backups of app data.

Build with JDK 17+ and the Android SDK (`ANDROID_HOME`, platform 36):

```
cd android && ./gradlew assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or open `android/` in Android Studio. CI builds the same debug APK on every pull request (artifact
`kohulabs-android-apk`), which installs on a phone with "Install unknown apps" allowed. For a Play Store build,
`./gradlew assembleRelease` (or `bundleRelease`) signs with the keystore named by `KOHU_KEYSTORE`,
`KOHU_KEYSTORE_PASSWORD`, `KOHU_KEY_ALIAS` and `KOHU_KEY_PASSWORD`.

### Day to day

- **Kō's home** shows a short message under Kō: whether today is planned, what's left, the next meeting, the emails
  waiting on you, and whether Google could be reached. Tap it for Today.
- **Kō plans each workday** (`DayPlanner.propose`, run by `FoundersStore` when the day is first read): your open tasks,
  soonest deadline first, as chunks (your chunk size, 25 minutes by default) in your working hours, around meetings and
  lunch, with 5-minute breaks. It's a proposal: Today shows it with **Accept** and **Plan again**, and asks "Anything for
  Revolut today?". Until you accept, the proposal follows what comes in (new meetings, new tasks); once accepted it stays
  put, and "plan again" re-plans what's left of the day.
- **Tasks** have a size and a deadline, read from how you say them: "proposal for Ana 2h by Friday",
  "#pessoal IRS até sexta", "revolut: onboarding review 45 min" (Revolut work goes to the Revolut tab). A task without
  a size is one chunk. Typed in the task box, said to Kō, or said into the mic.
- **Working hours:** weekdays 09:00 to 18:00, lunch 13:00 to 14:00 (setting `hours`). Tell Kō about a single day:
  "today I work until 20:00", "tomorrow I start at 11", "Friday off", "hoje trabalho até às 20" (setting
  `hours:YYYY-MM-DD`). Weekends are off unless you say otherwise.
- **Pull down to refresh** (anywhere but Kō's chat): the cloud imports Calendar and Gmail on the spot
  (`POST /api/refresh`, at most once a minute), then the app syncs; Kō thinks while it checks.
- **Voice:** the mic buttons (task box, Kō's chat) use the phone's own speech-to-text, so you can tell Kō a task out
  loud. It's the way in for work that can't be connected (Revolut).
- **Only true things:** where a feature isn't built yet (Kō's AI, the focus guard, MCP tools, Spend, the wake word),
  the app hides it instead of showing the design's sample.

## The screens (`web/founders/`)

No dependencies. `index.html` holds the design's template (from the Claude Design export, inside
`<template id="ko-phone">`); `dc.js` renders it (`{{ values }}`, `<sc-if>`, `<sc-for>`, and Kō, the stage bar and KPI
tiles as plain DOM); `founders.js` has the design's data, copy and logic, plus the app's additions (the stored day,
saving changes, the back button, sign-in); `founders.css` has the Kohu UI tokens and the phone frame.

To try them in a browser: `cd web && python3 -m http.server 8000`, then open http://localhost:8000/founders/. In a
browser they show the design's sample day and keep nothing; on a computer they sit in a phone frame. Deep links use
the design's props: `?screen=spend`, `?mode=revolut`, `?lang=pt`, `?screen=wake`.

To update from Claude Design, replace the template in `index.html` and the design's logic in `founders.js` with the
new export (the frame classes `kf-bezel`, `kf-screen`, `kf-status` and `kf-homebar` are the only template edits).
`js/signal.js`, the fonts and the icons are copies from the KohuLabs repository.

## Your data

### On the phone (`android/app/src/main/java/com/kohulabs/android/data/`)

The day lives in a database on the phone (SQLite through Room), so it works offline and survives restarts.

- **Tables** (`db/migrations/0001_init.sql` explains each): workspaces, tasks, chunks (a task's 15/25/45 minute slots
  on a day), goals, nudges, follow_ups, alarms, messages (the chat with Kō), day_reviews, meetings, usage (AI
  requests, for Spend) and settings. Every row has an `id` made on the phone, `updated_at` and `deleted`.
- **The same tables twice:** Room exports the phone's structure to `android/app/schemas/` on every build, and
  `db/check-schema.mjs` (in CI) fails if it differs from `db/migrations/`. When the structure changes, raise the
  version in `FoundersDatabase.kt`, add a Room migration, add the matching `db/migrations/000N_*.sql`, and run
  `node db/check-schema.mjs --write` (it regenerates `api/migrations.js`).
- **First day:** a new install starts with the design's sample day, dated today, in the app's language
  (`SampleDay.kt`), until Calendar and Gmail are connected.
- **A new day:** unfinished chunks move to the same slot today, or are split or dropped if the day review said so;
  unfinished daily goals carry over; the chat starts fresh (`DayPlanner.kt`).
- **How the screens use it:** `FoundersStore.kt` gives a day as JSON and saves changes; the WebView reaches it through
  `KohuBridge`. The current chunk's timer runs from when it started, across restarts.

### In the cloud (`api/`, android.kohulabs.com)

The day is also kept in the cloud, as a backup and for other devices later: the `kohulabs-android` Worker
(`wrangler.jsonc`) with a D1 database (SQLite on Cloudflare, bound as `DB`).

- **Setting it up** (once):
  1. Google Cloud console → APIs & Services → Credentials: an OAuth client (Web application) with the redirect URI
     `https://android.kohulabs.com/auth/google/callback`.
  2. Cloudflare dashboard → Workers & Pages → the `kohulabs-android` Worker → Settings → Builds: connect this
     repository, with the default commands (`npx wrangler deploy` for main, `npx wrangler versions upload` for other
     branches). The first deploy creates the database (no id needed: Cloudflare's automatic provisioning) and the
     android.kohulabs.com address.
  3. On that Worker, Settings → Variables and Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
     `SESSION_SECRET` (32+ random characters), as Secrets. Who may sign in is `FOUNDER_EMAILS` in `wrangler.jsonc`.
  On the first sync the Worker creates its tables from `db/migrations/`. `GET /api/status` says whether it is all set
  up: `{"configured":true,"sync":true}`.
- **Signing in from the app:** "Continue with Google Workspace" opens Google sign-in in a browser tab
  (`/auth/google`); it ends back in the app with a one-time code, which the app trades, with its PKCE verifier, for its
  own 90-day token (`POST /api/token`). The token is encrypted with a key held in the Android Keystore. If the Worker
  is not set up or not reachable, the app carries on, on the phone only.
- **Syncing** (`POST /api/sync`, `api/sync.js` and `Sync.kt`): every change the app makes is queued in an outbox on
  the phone. A sync sends the queue up and brings down what changed since the last sync; for each row the newest
  `updated_at` wins, on both sides. The cloud numbers every accepted change (`seq`), so the phone asks for
  "everything after N" without trusting its own clock, and long histories come in pages. Each person only sees their
  own rows (`user_id`). The app syncs when it opens, when it goes to the background, and a few seconds after changes.
- **Looking at the data:** Cloudflare dashboard → Storage & Databases → D1 → `kohulabs-android` → Console, or
  `npx wrangler d1 execute kohulabs-android --remote --command "SELECT …"`.

### Your real day from Google (`api/google-import.js`)

The Worker brings in each day from Google Calendar and Gmail, every hour from 05:00 to 21:00 UTC (`triggers` in
`wrangler.jsonc`) and right after a sync when the last import is over 50 minutes old, so a new sign-in shows the real
day within seconds. "Today" is counted in `TIMEZONE` (Europe/Lisbon).

- **Calendar** (`calendar.readonly`): today's events in the primary calendar, except all-day, declined and
  out-of-office ones, become a "Meeting" chunk at their real time in the Kohu workspace, plus a meeting with its
  attendees and Meet link. Moved or cancelled events update; what you did on the phone (done, skipped) is kept.
  Meetings never roll over to the next day.
- **Gmail** (`gmail.metadata`: sender and subject only, never bodies): unread threads in the inbox's Primary category,
  from people, become "waiting on you" follow-ups; once read, they are done. Newsletters and lists, no-reply and other
  automated senders, auto-replies, and mail from your own addresses are left out. The signed-in account
  (hello@kohulabs.com, new clients) goes to Kohu.
- **Your personal Gmail** (You › Settings › Personal Gmail › Connect): a second Google sign-in, for Gmail metadata only,
  kept in D1 (`google_links`, encrypted like the other). Its mail from people goes to Personal and opens in that account.
  Remove stops the import and removes its follow-ups.
- **A nudge each morning:** "Today: 4 meetings, 6 emails waiting", in the app's language.
- **The sample day** is cleared on the phone the first time a real day arrives (`FoundersStore`).

Sign-in asks Google for both scopes with offline access; the refresh token is kept in D1 (`google_accounts`, server
only, migration 0003), encrypted with a key derived from `SESSION_SECRET`. If Google access is removed, the import stops
and waits for a new sign-in. Setting it up, once:

1. Google Cloud console → APIs & Services → Library: enable the **Google Calendar API** and the **Gmail API**.
2. Google Auth Platform → Data Access → Add or remove scopes: add `.../auth/calendar.readonly` and
   `.../auth/gmail.metadata`. With the app set to Internal (your Workspace only), no Google verification is needed.
3. In the app: You › Sign out, then sign in again, and allow Calendar and Gmail.
4. For a personal Gmail (a gmail.com account): Google Auth Platform → Audience → User type **External**, then
   **Publish app** (In production). An Internal app only accepts your Workspace's accounts; in Testing, Google
   expires the access after 7 days. Unverified, Google shows a warning on the sign-in ("Google hasn't verified this
   app": Advanced › Go to …), which is fine for your own use. Who can use the app is still decided by
   `FOUNDER_EMAILS` here and by the portal's own lists.

## Tests

CI (`.github/workflows/ci.yml`) runs on every pull request and every push to main:

- **Worker:** `node --test api/test.mjs` (Node 22+; Node's SQLite stands in for D1) and `node db/check-schema.mjs`.
- **Screens:** `cd tests && npm ci && npx playwright install chromium && npm test` (desktop and phone; any page error
  fails the test). The Android bridge is stood in for, so the app's paths (stored day, saving, back, alarms) run too.
- **Android:** `./gradlew assembleDebug testDebugUnitTest lintDebug` in `android/`. With the Worker running locally
  (`node api/dev-server.mjs`, port 8799) and `KOHU_E2E_URL=http://127.0.0.1:8799`, it also syncs two pretend phones
  through the real Worker code, as CI does.

## Still simulated

Hidden in the app until built: Kō's AI (OpenRouter or a model on your computer over Tailscale, capped at $20 a month),
the wake word, the focus guard, the MCP servers, the Spend figures and the meeting screen (prep and follow-up).
