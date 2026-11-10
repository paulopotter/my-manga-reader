# Architecture Map — load when you need file locations or layer rules

Kotlin shell (`android/`) + React Native UI (`frontend/`) + OTA bundle.

---

## Directory Structure

```
my-kavita-app-reader/
├── android/                       # Kotlin shell (Android) — 9 Gradle modules
│   ├── core/                      # Room DB, migrations, schema validator, Hilt DB wiring
│   ├── tools/                     # Reusable capabilities: network (RequestTool), OTA, datetime,
│   │                             #   BackgroundExecute, config bridge (legacy)
│   ├── cache/                     # Generic cache module (:cache) — persistent / memoryKotlin / network
│   ├── preferences/               # Generic preference module (:preferences) — key/value/domain/variant
│   ├── server/                    # Content-server abstraction (:server) + nested plugins/kavita/
│   ├── content-digest/            # Domain contracts (:content-digest) — Page/Chapter/Series digests
│   ├── external-metadata-server/  # External metadata (:external-metadata-server) + nested plugins/m3/
│   ├── features/                  # LEGACY Kavita/BFF features — being removed (see "Legacy Kotlin")
│   └── app/                       # Android shell: MainActivity, AppReactPackage, NativeModule bridges
│
├── frontend/                      # React Native
│   └── src/
│       ├── screens/               # One folder per screen (domain-first)
│       │   └── reader/            # current file convention (see below); serie/ matches
│       │       ├── components/    #   one subfolder per dumb component
│       │       ├── hooks/         #   reader.hooks.ts, reader.reducer.ts
│       │       ├── modes/         #   webtoon.adapter.ts (per rendering-mode translation)
│       │       ├── reader.screen.tsx / .styles.ts / .types.ts
│       │       └── reader.model.ts / reader.window.ts   # screen-local pure model, no `Transform`
│       │   └── dashboard/         # "Home" tab: rails built by dashboard.tool.ts (screen-local, pure) from the
│       │                          #   series list; owns no cache — freshness is SerialRefreshTool's job
│       └── shared/
│           ├── components/        # Generic dumb components
│           ├── context/           # React contexts (startup, immersive)
│           ├── services/          # Layer 4 — chapters/pages/serials/servers
│           ├── tools/             # Layer 3 — domain normalizers + actions/methods/reader-prefs/start-screen-prefs/serial-refresh
│           ├── managers/          # Layer 3 infra — caches/preferences/events/store
│           ├── bridge/            # TypeScript types + NativeModule handles
│           └── i18n/              # strings by language + hooks
│
├── docs/                          # Public developer docs (architecture/, contributing/, external/)
├── site/                          # GitHub Pages (internationalised)
├── scripts/                       # build, setup, deploy, release, schema-validate helpers
└── .claude/                       # AI docs (English) — sessions/, completions/, skills/, agents/
```

---

## The reference architecture — 6 layers (plan 017)

One Gradle module per responsibility, all provider-agnostic except the plugin layer.

| Layer | What | Modules / folders |
|---|---|---|
| 0 | OS / native primitives | — |
| 1 | **Named plugins** — the only place a provider's real name/API is known | `:server/plugins/kavita/`, `:external-metadata-server/plugins/m3/` |
| 2 | **Plugin abstraction** — reduces coupling to the named plugin | `:server`, `:external-metadata-server`, `:cache`, `:preferences` |
| 3 | **Domain contracts** — compose Layer 2 into lapidated shapes (optional per domain) | `:content-digest` (Kotlin); `shared/tools/`, `shared/managers/` (RN) |
| 4 | **RN Services** — group Layer 3 (or Layer 2) into screen-ready data | `shared/services/` |
| 5 | **Front** — screens, components, navigation, theme | `frontend/src/screens/`, `shared/components/` |

**Access rule**: a module accesses itself (same-layer composition) or the layer directly below.
One named exception: **Layer 4 may reach Layer 3 *or* Layer 2 directly** (never Layer 1) — this
is what lets a domain skip Layer 3. Any other cross-layer skip needs an explicit, justified
exception (same bar as the Reader's native-rendering exception below).

**A plugin lives physically nested inside the Layer 2 module that understands it**
(`server/plugins/kavita/`), never in a neutral shared folder — so an out-of-layer import is
visibly wrong from the folder structure alone.

**Generalizer pattern** (Task 014): every point that talks to the outside world gets the full
structure — a Layer 2 "generalizer" Gradle module with `plugins/<name>/` (Layer 1 raw plugin)
nested inside, an internal adapter interface plugins implement, and the generalizer's own public
API (free to name/shape methods differently from that interface — e.g. `Server.getChapter` vs.
the adapter's `getChapter`). The trigger is **"does this talk to the outside?"**, never "how
many providers might it have" — a domain with one plausible provider forever still gets the full
shape. The inverse: code that lives entirely *inside* the app never becomes a Layer 1 plugin.
`:server` (Kavita) and `:external-metadata-server` (m3) are the two instances today; a new
external connection (notifications, a second metadata source) reuses this shape.

**Data flow**: `Bridge → Service → Tool/model → Hook → Screen → Component`. There is no
per-screen `Transform` layer (see "No `Transform` layer").

---

## Domain Composition — micro → macro

```
Page  →  Chapter  →  Series  →  Library
(micro)                         (macro)
```

Each domain only handles its own concern and delegates **downward** to the smaller domain:

- `Chapter` formats/handles a chapter. `Series` calls the Chapter module when it needs chapter
  data — it never re-derives it (e.g. never reads a chapter cache row itself).
- `Library` is a **listing operation on Series** + a Layer 4 Service — there is no Layer 3
  Library contract (a simple-enough domain skips Layer 3).
- Same-layer composition is expected: `buildSeriesDigest` calls the Chapter module (both Layer
  3); `buildChapterDigest` calls the Page module. What's forbidden is a domain computing
  another domain's data instead of asking that domain's module.

**In Kotlin**: `:content-digest` composes Page→Chapter→Series in one place
(`contentdigest/{page,chapter,series}/`). Kotlin holds only the minimum Android-only logic
(Room cache, authenticated HTTP, plugin adapters); ordering/formatting/business rules live in
`:content-digest` or RN, never duplicated.

**In RN**: the canonical shape of each domain is defined in `shared/tools/<domain>/`
(`ChapterTool`, `SerieTool` in `serials/`, `ChaptersTool`); Services (`shared/services/<domain>/`)
aggregate digests into screen-ready data. `shared/transforms/` no longer exists.

---

## Kotlin modules

### `:core` — infrastructure (common)

Room `AppDatabase` (schema v14), migrations in **pairs** (forward + backward, e.g.
`Migration_13_14` + `Migration_14_13`), `SchemaValidator`, Hilt `DatabaseModule` (`@Provides`
each DAO + registers all migrations). `core ← tools ← features` — never depends upward.

Room tables split by model:

| New model (active) | Purpose |
|---|---|
| `CacheEntity` (`:cache`) | Generic cache — `(key, variant)` PK, `domain`, `ttl`, `expiresAt` |
| `PreferenceEntity` (`:preferences`) | Generic prefs — key/value/domain/variant, no TTL |
| `ServerGroupEntity` / `ServerUrlEntity` | Server groups + URLs (`:server`) |
| `ExternalMetadataGroupEntity` / `ExternalMetadataUrlEntity` | Groups + URLs (`:external-metadata-server`) |
| `PageCacheEntity` | Page-URL cache (reader data side) |

| Legacy model (being removed) | Still used by | Goes when |
|---|---|---|
| `ChapterCacheEntity` / `SeriesDetailCacheEntity` | `KavitaChapterFeature`, `KavitaSeriesFeature`, `SeriesModule` | Reader/Series Kotlin fully off `KavitaXFeature` |
| `ReadingProgressEntity` | `KavitaChapterFeature` | idem |
| `AuthConfigEntity` | `KavitaAuthFeature`, `ConfigStore` | Kavita auth moves to `:server/plugins/kavita/auth/` |
| `ServerConfigEntity` | `StartupModule`, `ConfigStore`, `KavitaUrlSelector`, `BffFeature` | URL selection fully in `:server` |
| `BffServerConfigEntity` | `BffFeature`, `ConfigStore` | BFF fully off the old feature |
| `BffMatchEntity` | *nobody* — registered only | its own DROP-table task |

### `:tools` — reusable capabilities (common base)

`network/RequestTool.kt` (central HTTP), `network/ActiveUrlSelector.kt` (picks a healthy URL —
has a known race, not yet migrated to `Cache.network`), `ota/OtaManager.kt` (checks
`latest.json`, downloads, swaps on next boot, rollback after N crash-free opens; staleness via
build timestamps, not version strings), `datetime/IsoDateTime.kt`, `cache/BackgroundExecute.kt`
(generic fire-and-forget over `Cache`), `bridge/ConfigRepository.kt` + `ConfigStore.kt` (legacy
config bridge — server/auth/BFF; the `*UiPreferences*` methods were removed in Task 039).

**Diagnostics** (`tools/diagnostics/`) — two local files in the app's external `diagnostics/` dir,
both rotated (2 × 512 KB), nothing leaves the device: `DiagnosticLog` → `app-diagnostics.log`
(human-readable: crash stack traces, `ProcessExits` = why Android says the previous process ended,
`[Memory]` lines, filtered logcat) and `MetricsLog` → `app-metrics.jsonl` (one `MetricsSample` per
line: memory, CPU time, battery %, charging, screen on, foreground, notification service running,
threads). `MetricsCollector` reads the phone; `:app`'s `AppMetrics` fills in the app state and says
*when* (`start`, `periodic` every 5 min, `trim`, `crash` — written by `CrashGuard`). A file, not a
Room table, on purpose: a metrics bug can never touch the database. `make metrics` pulls both
files (+ the system's `dumpsys meminfo/batterystats`) to `metrics/<date>/` and
`scripts/metrics-report.py` summarises per app state or compares two pulls. Battery numbers are
the *phone's* drop in that state — an upper bound for the app, not its share.

### `:server` — Layer 1 + 2 (content-server abstraction)

Replaces `KavitaSeriesFeature` / `KavitaChapterFeature` / `KavitaUrlSelector` / `KavitaAuthFeature`.

| File | Layer | Role |
|---|---|---|
| `server/Server.kt` | L2 facade | **Routing only** — knows the active plugin, delegates. Manages `ServerGroupDao`, validates credentials, exposes `ServerResponse<T>` (`data` + `ServerActiveInfo` + `resolvedAtEpochMs`). Direct domain methods (`getChapter`, `getSeries`). |
| `server/plugins/ServerPlugin.kt` | L2 | Interface + provider-agnostic shapes (`PluginSerial`, `PluginChapter`, `PluginProgress`…), named in contract vocabulary, not DTO vocabulary. |
| `server/plugins/kavita/KavitaServerPlugin.kt` | L1→L2 | Adapter: raw Kavita ↔ generic shape. Holds decoded apiKey/JWT. `companion object Info` = plugin registration. |
| `server/plugins/kavita/{auth,chapter,series}/Kavita*.kt` | L1 | Real Kavita REST (endpoints, DTOs) for auth, chapter/page, series. |

`ServerResponse<T>`: every content-read method returns `data` + provenance in one envelope
(kills the race a separate `getActiveInfo()` call would have). When a Layer 3 contract makes
several `:server` calls, it keeps a running `server`/`resolvedAtEpochMs` pair overwritten after
each call that *succeeds* — a tolerated failure leaves the last good value untouched.

### `:content-digest` — Layer 3 (domain contracts)

Composes Page→Chapter→Series in one place, cache-first built in.

| File | Role |
|---|---|
| `contentdigest/page/PageDigest.kt` | `sealed interface PageDigest` (Success/Failure). `buildPageDigest(server, chapter, pageIndex, cache, force)` — url + dimensions + orientation + cache provenance. |
| `contentdigest/page/ChapterSummary.kt` | Subset of chapter fields resolved *before* `ChapterDigest` builds `pages.list` — passed down to `buildPageDigest` to break the circularity. |
| `contentdigest/chapter/ChapterDigest.kt` | `interface ChapterFields` + `sealed interface ChapterDigest` + `ChapterNeighborDigest` (no prev/next — cuts recursion). `readStatus` from `pages.count`/`readCount`. prev/next **merged** on write, not overwritten. |
| `contentdigest/series/SeriesDigest.kt` | `interface SeriesFields` + `sealed interface SeriesDigest`. `chapters` built by calling the Chapter module (same layer). `resumePoint` cascade IN_PROGRESS → UNREAD → null. `metadata` = a 2nd network call. |
| `contentdigest/series/ExternalMetadataDigest.kt` | 2-state digest of a series' external metadata — Success may carry `match = null`. |
| `contentdigest/error/ErrorDigest.kt` | `data class ErrorDigest(code, message)` shared by Page/Chapter/Series. |

**Result types are the `sealed interface` itself** — `PageDigest.Success` / `.Failure` are the
two variants directly (no separate `XResult` wrapper). Same idiom as `OtaCheckResult`.

### `:cache` — Layer 2 (generic cache)

Replaces `@Volatile var` fields, per-domain Room cache tables, hand-rolled `Mutex`+`Map`.

```kotlin
class Cache {
    val persistent: Persistent      // Room-backed, survives restart
    val memoryKotlin: MemoryKotlin  // in-process Map, dies with the Kotlin process
    val network: Network            // single-flight + TTL around a suspend block (not a value store)
    fun storeFor(mode: CacheMode): CacheStore
}
```

- `persistent`/`memoryKotlin` share `CacheStore`
  (`get`/`put`/`invalidate`/`invalidateDomain`/`invalidateVariant`/`purgeExpired`/`purgeOlderThan`).
  `put()` returns the `CacheDescriptor` it produced (never `Unit`).
- `network`: `run(key, ttlMs, block)` — a `Mutex` per key (not one global lock) + a TTL window.

**Key/variant/domain** (`CacheEntity`): `domain` is a caller label (`"page"`/`"chapter"`/…)
opaque to `Cache`, only for `invalidateDomain`/`invalidateVariant`. `variant` names which
parameter(s) change a payload's shape (`"full"`, `"full:external"` — never the values); `key` =
entity id + those values positionally (`"c1:true"`). No such parameter → `variant = ""`, `key` =
bare id. PK = `(key, variant)`.

**`CacheDescriptor`** is created at Layer 1, embedded in each digest's own `cache` field,
`@Transient` (never serialized into the cached JSON — circular + redundant; always rebuilt from
the real `CacheEntry` on read).

### Cache-first pattern (`buildPageDigest` / `buildChapterDigest` / `buildSeriesDigest`)

Each builder takes `cache: Cache` (required, passed explicitly — never a module singleton) and
`force: Boolean = false`:

- `force=false` + fresh hit → cached value, no network.
- `force=false` + stale hit → returns the stale value now, fires a background refresh (same
  function, `force=true`, own `CoroutineScope`) — the caller never waits.
- `force=false` + miss, or `force=true` → fetch fresh, write before returning (a forced call
  never skips the write, only the read).

`force` propagates top-down: a forced Series refresh forces every Chapter and every Page.

Keys today: Page `"chapterId:pageIndex"` (`domain="page"`, `variant=""`); Chapter
`"chapterId:full"` (`domain="chapter"`, `variant="full"`); Series
`"seriesId:full:includeExternalMetadata"` (`domain="series"`, `variant="full:external"`). All
`mode = PERSISTENT` — no domain has needed `MEMORY_KOTLIN` yet (decided per case).

**Known trade-off (backlog 017, not solved)**: a Chapter's cached JSON embeds its full
`PageDigest` list (each Page also has its own cache entry — real duplication); a Series embeds
full Chapters. A referenced-by-key cascade would fix it at the cost of N synchronous reads and
harder staleness semantics.

> **Read-path precedence** (force wins / cache-first + bg refresh / optimistic-local, and how
> they compose — timestamps are the tiebreaker, not source priority) lives in
> [`data-freshness.md`](data-freshness.md). Every read path follows it; when a concrete rule
> seems to contradict it, the principle wins.

### `:preferences` — Layer 2 (generic preferences)

Replaced `series_sort_prefs` and `ui_preferences` entirely (the latter dropped in Task 039).
Facade `Preferences.kt`: `get`/`put`/`delete`/`deleteDomain` (key/value/domain/variant), thin
passthrough to `PreferenceDao`. **No TTL** — a preference is the source of truth, never stale.
Single backend (Room) → `PreferenceDescriptor` has no `mode`.

Domains on `:preferences` today: `chapterSortPrefs` (`ChaptersTool.sort`), `libraryLayout`
(`library.prefs.ts`), `readerPrefs` (`ReaderPrefs` — keep-screen-on / immersive),
`readingModePrefs` (`ReadingModeTool`).

### `:external-metadata-server` — Layer 1 + 2 (external metadata)

Replaces `features/bff/BffFeature.kt`. Own module because it enriches by correlated id, it
doesn't read content. Facade `ExternalMetadataServer.kt` manages groups + `match`/`matches`
(given a batch of series refs, returns metadata matches), exposes `ExternalMetadataResponse<T>`.
`plugins/m3/M3Plugin.kt` is the user's personal BFF, uses `Cache.network` for single-flight.

### `:app` — Android shell + NativeModule bridges

`MainApplication.kt` (Hilt `Application`, injects everything into `AppReactPackage`, runs
`OtaManager.discardStaleBundleIfNeeded()` on `onCreate`), `MainActivity.kt` (`ReactActivity`,
owns the Android-12 splash via `core-splashscreen` — there is no `SplashActivity`),
`AppReactPackage.kt` (**central registry of every NativeModule** — built by hand in
`createNativeModules()`; Hilt injects deps *into `AppReactPackage`*, not into each bridge),
`CrashGuard.kt`, `ReactBridgeSupport.kt` (`emitEvent` + `Result<T>.resolveOrReject`).

**One NativeModule per responsibility, not per screen:**

| Bridge | Reaches | Notes |
|---|---|---|
| `DigestBridgeModule` (+ `DigestBridgeMappers`) | `:content-digest` builders | `getPageDigest`, `getChapterDigest` (`{full, force}`), `getSeriesDigest` |
| `ServerBridgeModule` | `:server` | server groups, `listSerials`, plugin-level reads/writes (`setChapterRead`, progress) |
| `CacheBridgeModule` (+ `CacheBridgeMappers`) | `:cache` | `persistentX`/`memoryKotlinX` × get/put/invalidate/purge. `network` **not** bridged (its `block` is Kotlin) |
| `PreferencesBridgeModule` (+ `PreferencesBridgeMappers`) | `:preferences` | get/put/delete/deleteDomain |
| `ExternalMetadataBridgeModule` | `:external-metadata-server` | groups + `match`/`matches` |
| `FollowedSeriesBridgeModule` | `FollowedSeriesDao` | follow is 100% local — separate from `SeriesModule` so `SerieTool` depends on just the DAO |
| `ScreenControlModule` | WindowManager | `keepScreenOn`/`allowScreenOff`/`setImmersiveMode` — side-effect-only since Task 039 |
| `NetworkStatusModule` | `ActiveUrlWatcher` | `activeUrlChanged` stream — genuinely native origin |
| `OtaEventBridge` / `OtaBindingsModule` | `:tools` OTA | `otaBundleReady` event + Hilt `@Binds` |
| `ReaderPageListView` / `ReaderPageListViewManager` | `ReaderPageList.kt` | Compose view exposed to RN (see Reader exception) |
| `SeriesModule` (legacy) | `KavitaChapterFeature` / `KavitaSeriesFeature` | `getSeriesDetail`, `getCachedChapters`, `markChaptersRead/Unread`, `seriesFollowedIds` emitter. Shrinking; still used by the reader's mark path |
| `ReaderChapterModule` (legacy) | `ChapterDataSource` | thin RPC — stays until the reader's non-digest consumers migrate |
| `StartupModule` / `SetupModule` (legacy) | `SplashSyncCoordinator`, `KavitaAuthFeature`, `BffFeature` | splash sync + onboarding |
| `ConfigRepository` / `DbValidator` (legacy) | `ConfigStore` | server/auth/BFF config; DB health for the splash |

### Legacy Kotlin — `:features` (being removed)

Everything in `android/features/` is the pre-plan-017 model. `:server` + `:content-digest`
replace it. Still alive:

| File | Replaced by | Removed when |
|---|---|---|
| `features/kavita/KavitaSeriesFeature.kt` | `:server` KavitaSeries + `:content-digest` SeriesDigest | `SeriesModule` / `SplashSyncCoordinator` off it |
| `features/kavita/KavitaChapterFeature.kt` (impl. of `ChapterDataSource`) | `:server` KavitaChapter + `:content-digest` ChapterDigest/PageDigest | `ReaderChapterModule` / `SeriesModule` off it |
| `features/kavita/chapter/ChapterDataSource.kt` | digest stack | its last consumers migrate |
| `features/kavita/KavitaAuthFeature.kt` | `:server/plugins/kavita/auth/KavitaAuth.kt` | `SetupModule` migrated |
| `features/kavita/KavitaUrlSelector.kt` | URL selection rises into `:server` | (Task 012 decision) |
| `features/kavita/ActiveUrlWatcher.kt` | — **stays** (genuinely native origin) | — |
| `features/bff/BffFeature.kt` | `:external-metadata-server` + `M3Plugin` | `LibraryModule.syncBff` gone (done) / `SetupModule` migrated |
| `features/startup/SplashSyncCoordinator.kt` | (to redefine once Library/Reader fully migrate) | — |
| `features/kavita/reader/ui/*` (`ReaderPageList.kt`, `SduNode.kt`, `PagePreloader.kt`, …) | — **stays** — the native-rendering exception, not legacy | — |

---

## Screen file convention (RN)

**Current** — `serie/`, `reader/`, `config/reader/` (rewritten / added under plan 017) and
`search/` (backlog 009), the target for any new or migrated screen:

- `<name>.screen.tsx`, `<name>.hooks.ts` (in `hooks/`), `<name>.types.ts`, `<name>.styles.ts` —
  all kebab-case, role in the filename.
- Each dumb component gets its own subfolder: `components/<comp>/<comp>.component.tsx` +
  `<comp>.styles.ts` + `<comp>.tests.tsx` + `index.ts`. Style is always a separate file (no
  inline `StyleSheet.create` in a `.component.tsx`).
- Pure state-shape logic only this screen has → a screen-local model file
  (`<name>.model.ts` / `<name>.window.ts`), never a `transforms/` folder. **A screen is its own
  micro-ecosystem** — it may keep its own `hooks/`, `components/`, local model/adapter files;
  shared domain logic still lives in `shared/tools/<domain>/`.

**Legacy** — `config/` (except `config/reader/`), `following/`, `library/`, `setup/`,
`splash/`: `LibraryScreen.tsx`, `useLibrary.ts` (PascalCase, flat, `use*` hook). Some already
have a `hooks/` subfolder (`library/hooks/library.hooks.ts`). Migrate to the current convention
when a screen is next touched substantially; don't rename wholesale for its own sake.

### No `Transform` layer

**There is no `transforms/` folder and no `*Transform.ts` file in a screen** (nor a
`shared/transforms/` folder any more). Pure derivation lives in one of:

- **The domain `Tool`** (`shared/tools/<domain>/<domain>.tool.ts`) — normalizing/formatting that
  domain's entity, for anything reusable across screens (`ChapterTool.format.title`,
  `ChapterTool.mark.*`, `SerieTool.normalize.card`).
- **A screen-local model file** (`<name>.model.ts` / `<name>.window.ts`) — pure state-shape
  logic only that screen has (the reader's `reader.model.ts` chapter helpers and
  `reader.window.ts` `ReaderWindow` math — Task 037).
- **The mode adapter** (`<screen>/modes/<mode>.adapter.ts`) — per-rendering-mode translation
  (webtoon report → trigger, window → native blocks).

`serie/` already follows this (`sortChapters` inline in `serie.hooks.ts`, normalization in
`SerieTool`/`ChapterTool`). Task 037 dissolved the reader's `transforms/` folder.

---

## RN shared layers

### `shared/components/` — Layer 5 (generic dumb components)

`app-versions/`, `confirm-dialog/`, `follow-star/`, `scroll-to-top-button/`,
`selection-bottom-bar/`, and `card/` — the serial row, with `card/list/` nested as its list
variant (a list row is the same card in another layout, not a different component). Both take a
`SerialCard` spread as props and render strings only; the labels are built by
`SerieTool.normalize.card`, never in the component. Promoted out of `screens/library/` in backlog
009, when Search became the second consumer.

### `shared/services/` — Layer 4

Thin wrappers: aggregate Layer 3 (digest) or Layer 2 (server) into screen-ready data. No cache,
no transformation — the caller gets exactly what the bridge produced.

- `chapters/chapters.services.ts` — `ChapterService`: `get`/`getFull` via
  `DigestBridge.getChapterDigest`; `raw`/`progress`/`status` via `ServerBridge`.
  `status.set({seriesId, chapterId, isRead})` is the current mark path.
- `pages/pages.services.ts` — `PageService`: `get` via `DigestBridge.getPageDigest`.
- `serials/serials.services.ts` — `SerialsService`/`SerialService`: `list` direct on
  `ServerBridge.listSerials`; `get`/`getFull` (single series, `{full, force}`),
  `chapters.status.set` (batch mark).
- `servers/servers.services.ts` + `servers/external.services.ts` — server groups; external
  metadata `match`/`matches`.

**Conventions** (Task 021, project-wide for new code):

- **File naming** `name.type.ext` (`pages.services.ts`, `pages.tests.ts`); folder/file always
  plural even when the domain's real operations are singular-only. Tests live beside the file
  (the older `__tests__/` pattern is not migrated retroactively). `index.ts` is re-export only.
- **Namespace**: a plural const (`SerialsService`) holds batch ops (`list`); a singular const
  (`SerialService`) holds single-item ops (`get`/`getFull`). No empty plural namespace created
  speculatively. Every exported name ends in `Service`.
- **Args**: any method with ≥1 argument takes exactly one named object, never positional (so
  `Methods.bound()` can merge fixed fields generically). A `full` flag is two methods (`get` /
  `getFull`), never a boolean. A binary bridge write (`setChapterRead`) is 3 methods:
  `status.set({..., isRead})` + `read`/`unread` wrappers.
- **`raw`** is the one namespace for direct non-digest bridge reads (`ChapterService.raw.get` →
  `ServerBridge.getChapter`).
- **Isolation**: a Service only ever calls its own bridge file(s) — `DigestBridge` and/or
  `ServerBridge`. It never imports another domain's digest/Service to reach data it doesn't
  already have embedded — it calls that domain's **Service**. (This governs the Service *code*'s
  imports; a bridge payload that already embeds `chapters.list` is returned as-is, not
  re-fetched.)
- **`bound(fixed)`**: every Service exposes one — `ChapterService.bound({seriesId, chapterId})`
  returns an equivalent object where each method takes a partial arg with `fixed` merged in.
  Pure convenience over repeating ids, never a cache — every call still hits the bridge fresh.

### `shared/tools/` — Layer 3 (domain normalizers + generic tools)

Where the **canonical shape** of each domain is defined in RN, and optimistic actions live.

- `chapters/chapters.tool.ts` — `ChapterTool` (`normalize`, `format.title`,
  `mark.read/unread/toggle/readMany/unreadMany` — optimistic → confirm → revert, via `onUpdate`
  **and** `EventBus.emit(ChapterEvents.readStatusChanged, …)`). `ChaptersTool.sort` (global +
  per-series override, via `PreferencesManager`).
- `serials/serial.tool.ts` — `SerieTool` (`normalize.digest` → `Serie`; `normalize.card` →
  `SerialCard`, the row shape a card/list item renders, labels already localized; `relabel`
  rebuilds those labels from the row's own raw fields after an in-place patch or a language
  change; `isFollowed`, `toggleFollow` optimistic via `FollowedSeriesBridge`). Its plural
  sibling `serials/serials.tool.ts` holds `SeriesTool.normalize` (a digest list → `Serie[]`).
- `reader/reader-prefs.tool.ts` — `ReaderPrefs` (keep-screen-on / immersive, `:preferences`,
  domain `readerPrefs`). In `shared/` because both Config and Reader consume it.
- `actions/action.tool.ts` — `ActionContract` + `createNavigateAction(...)`, EventBus-ready.
- `methods/methods.tool.ts` — `Methods.requireArgs(...)` (guards required fields against plain-JS
  callers) + partial-arg walker.

### `shared/managers/` — Layer 3 infra (not domain tools)

Generic RN infra, siblings of `:cache`/`:preferences` on the RN side.

- `caches/` — `CacheManager` dispatches by mode (PERSISTENT / MEMORY_KOTLIN / MEMORY / NETWORK)
  to the right handler. Thin — the cache-first *decision* lives in the Kotlin digest builders.
  `network` is JS-only (the `block` never crosses the bridge). The RN-only `MEMORY` mode is not
  built yet.
- `preferences/` — `PreferencesManager`, thin passthrough to `PreferencesBridge`.
- `events/` — `EventBus` (singleton pub/sub) + `createEvent<T>(name)` + `useEvent(token, handler)`.
  RN→RN mechanism. Chain-cycle guard (same token re-entering / depth > 50).
- `store/` — `ReadingProgressManager` (reader's local `{seriesId, page, scrollFraction}` per
  chapterId, `domain: 'readingProgress'`, no TTL — its `cachedAtEpochMs` IS "updated at";
  `resolveInitialPage` compares it against the server `resumePoint.recordedAtEpochMs`, newest
  wins), `series-digest.store.ts` (SeriesDigestIndex the Library reads).

### `shared/bridge/` — types + NativeModule handles

`index.ts` re-exports everything, renaming legacy types to `Legacy*` so they don't collide with
the real ones in `digest.ts`. New: `digest.ts`, `server.ts`, `cache.ts`, `preferences.ts`,
`external.ts`, `followedSeries.ts`. Legacy: `series.ts` (`SeriesBridge`), `config.ts`
(`ConfigRepository` — `UiPreferences` removed in Task 039), `startup.ts`, `chapter.ts`,
`page.ts`. Common: `network.ts` (`ActiveUrlChangedEmitter`).

---

## The 3 communication mechanisms (Task 013)

1. **RN → Kotlin** — always `@ReactMethod` + `Promise` (request → execution → direct response).
   No "imperative ref call" shape — a native-view command is a regular module method that
   resolves its Promise only when the view confirms.
2. **Kotlin → RN** (`NativeEventEmitter`, multi-listener) — **only** events Kotlin observes on
   its own, never a response to an RN request (physical scroll `onVisiblePageChanged`, active-URL
   change, Room `Flow`). Kotlin never broadcasts a confirmation of something RN asked for —
   whoever asked gets the result directly, and propagating it further is that RN caller's job.
3. **RN → RN** (`EventBus`, `shared/managers/events/`) — events with no native origin at all.
   Each event is a typed **token** declared next to whoever first emits it
   (`ChapterEvents.readStatusChanged` in `chapters.tool.ts`).

---

## Reader Screen — the one native-rendering exception

`screens/reader/` is the **only** screen where pixels are drawn by Kotlin. Every other screen is
100% RN — a deliberate, narrow exception, not a precedent.

**Why**: manga/webtoon pages are tall bitmaps (10,000+ px). FlashList (originally planned — see
`completions/007-*`) hits Android's `GL_MAX_TEXTURE_SIZE` on some devices: a page taller than
the GPU max renders collapsed or black, regardless of how JS slices scroll. No RN-only list
avoids this. The fix is a Compose `LazyColumn` (`ReaderPageList.kt`, `features/kavita/reader/ui/`)
exposed to RN as one native view (`ReaderPageListView` / `ReaderPageListViewManager`).

### If native rendering is ever needed for another screen

Last resort, only for a platform ceiling no RN-side fix can reach. Same shape, in order:

1. **RN owns every decision, Kotlin only draws.** Loading, advance/retreat, all business logic
   stays in `reader.hooks.ts`. The native view receives a list and reports what's visible
   (`onVisiblePageChanged`) or what happened (`onTap`, `onScrollToChapterHandled`).
2. **Server-Driven UI for anything but raw content.** RN sends a small generic node tree
   (`SduNode.kt`: `Container`/`TextNode`/`Spacer`, interpreted by `SduNodeView`). Kotlin never
   encodes what a "header" is. Extend the vocabulary only on a real need.
3. **Single Responsibility per Composable/file.** `ReaderPageList.kt` lays out + reports scroll;
   `SduNodeView` interprets nodes; `ReaderPageImage` decodes one page; `PagePreloader` /
   `SafeBitmapDecoder` handle loading.
4. **Event-oriented, never polled.** Discrete RN events via `RCTEventEmitter`. One-shot requests
   ("scroll to this chapter") are cleared to null by RN once handled.
5. **Decoupled from any provider.** The View's props (`ChapterBlock`: `chapterId`, `pageUrls`,
   `pageAspectRatios`, `firstNode`, `lastNode`) carry plain data — the rendering layer has no
   idea what "Kavita" is.

### Chapter-switch contract (`ReaderWindow` + `moveFocus`)

The reader had recurring navigation bugs (pressing "next" on chapter 26 jumped to 28) caused by
**two uncoordinated mechanisms writing the same navigation state** — native continuous scroll
and the overlay arrow, racing a read-modify-write on a `{prev, curr, next}` trio. The rewrite
replaces that with one model, one path:

- **`ReaderWindow { entries: LoadedChapterEntry[]; focusedIndex: number }`** — a position-indexed
  window (ruler + pointer), a contiguous slice of the series' canonical reading order.
  `focusedIndex` is the *only* source of truth for "where the user is". Moving chapter = moving
  the index, one atomic reducer assignment. **Append-only** on natural scroll
  (`computeWindowAfterFocusMove` only moves the index or grows an end) — never reorders/drops, so
  the native scroll position stays valid across a crossing.
- **One path for a scroll crossing: `moveFocus(trigger)`** in `reader.hooks.ts`. The screen
  forwards the native payload verbatim (`onNativePosition`); the hook dispatches
  `MOVE_FOCUS { trigger, order }` and the **reducer** computes the transition against its own
  `state.window`, so two reports in one React batch serialize. No settling timer, no parallel
  window copy.
- **Arrows / jump reload, they don't scroll.** They call
  `openChapter(targetId, { startAtBeginning: true })` — the same flow that opens the screen —
  building a fresh `[prev?, target, next?]` window and bumping `State.nativeListKey`. The screen
  passes `nativeListKey` as the `key` of `<ReaderPageListView>`, so React remounts the native
  view fresh on the target chapter with no inherited scroll offset. Deliberate:
  `scrollToItem` / `scrollToPositionWithOffset` proved unreliable across many device builds. A
  natural-scroll crossing does **not** bump `nativeListKey`.
- **Cold-open prev.** A bare `ChapterService.getFull` carries no embedded `prevChapter` (only a
  Series-driven fetch attaches those), and on first open the canonical order hasn't loaded — so
  `buildWindow` can't include the prev. `reconcileWindow` (run once the order lands) prepends it.
- **`scrollRequest`** — a one-shot `{ chapterId, page }` used only for "continue reading" (initial
  page != 0), never set by a native-scroll report. Consumed via `onScrollToChapterHandled`.

The Kotlin side is unchanged by this contract — window, `moveFocus`, reducer, remount trigger are
all RN. If a piece looks easier in Kotlin, that's a design error in the RN model, not an
exception.

### `ChapterDataSource` — the swappable-provider boundary (legacy)

The reader's own chapter/page data now comes through `shared/services/chapters`
(`ChapterService.getFull` → `DigestBridge.getChapterDigest`) backed by `:content-digest`.
`ChapterDataSource` (`features/kavita/chapter/`) remains the boundary for its *other* consumers
(`SplashSyncCoordinator`, and concrete `KavitaChapterFeature` calls from `SeriesModule`). It's a
provider-agnostic interface (`getPageUrls`, `getPageDimensions`, `getLocalProgress`…);
`KavitaChapterFeature` implements it; `FeaturesModule` binds them via Hilt `@Binds`;
`ReaderChapterModule` depends on the interface, never the concrete class.

### Immersive mode

`ScreenControlModule.setImmersiveMode(enabled)`: hides system bars +
`layoutInDisplayCutoutMode = SHORT_EDGES` (API 28+) so content draws behind the notch, and a
decorView inset listener zeroes `systemBars()` + `displayCutout()` (RN's `ReactRootView` would
otherwise re-add padding). RN side: `shared/context/immersive/` — `App.tsx` drops its root
`paddingTop: statusBarHeight` while `immersive` is on (set by `reader.hooks.ts` on mount,
cleared on unmount). Immersive off keeps the padding so notifications stay visible.

---

## Kotlin Layer Rules (legacy 3-layer, still true for `:core`/`:tools`/`:features`)

| Layer | May depend on | Never depends on |
|---|---|---|
| `core/` | — | `tools/`, `features/` |
| `tools/` | `core/`, `cache/` | `features/` |
| `features/` | `core/`, `tools/` | — |
| `app/` | all | — |

`:cache` was promoted next to `:core` (as generic as `:core` itself) so `:tools` can depend on
it without inverting `core ← tools`.

---

## Layered preference override

A setting can exist at up to three priority levels — session-only (in-memory, resets on screen
exit), per-item persisted override (with an explicit reset-to-default action), app-wide global
default. Effective value resolved top-down (session > per-item > global) each screen load. Used
for chapter sort mode (`ChaptersTool.sort`) and reading mode (`ReadingModeTool`); reuse this
shape for any "quick session tweak vs. sticky per-item vs. app default" setting.

---

## Versioning

- `android/app/build.gradle.kts` → `versionName` (APK). `versionCode` is derived from
  `git rev-list --count HEAD` — never hand-edited.
- `frontend/package.json` → `version` (JS bundle; read into `BuildConfig.RN_VERSION`, shown as
  "F:" in the version footer).
- Both bumped by the `versionar-build` skill before any device build (`-rcN` for unapproved
  test builds, stripped on approval).

## android/node_modules

A **symlink** to `frontend/node_modules` — the Android Gradle plugin for RN resolves packages
relative to `android/`. Created by `make setup`, never committed. After a fresh clone: `make
setup` before `make build-android`.

## Generated Assets (Metro)

`make build-bundle` copies `frontend/src/assets/` into `android/app/src/main/res/drawable-*/`
with a path-encoded name (`src/assets/ic_splash.png` → `src_assets_ic_splash.png`). Density
suffixes map `@1x`→mdpi … `@4x`→xxxhdpi. Not committed (`.gitignore` excludes
`drawable-*/src_assets_*`).


---

## Sensitive-content filter (render-time; code name "adult")

- **Provider side** — `ServerPlugin.categories` is an optional capability: `list()` (names) and
  `serialIds(names)` (series ids carrying any of them). The Kavita plugin resolves name → numeric
  id internally (`/api/Metadata/genres|tags`, then a second `all-v2` filtered with `Genres`/`Tags`
  `Contains`, OR-ed). Only names and series ids cross the `:server` boundary; a provider without it
  answers with empty lists. No digest: one source, nothing to compose.
- **RN side** — `CategoriesService` → `ServerBridge`. `AdultFilterProvider`
  (`shared/context/adult-filter/`) holds the user's choices (`AdultFilterPrefs`, by category
  name) and the last classification `{ adultIds, knownIds }`, persisted so the first paint is
  already filtered. A series outside `knownIds` is *pending* and treated as adult until the next
  classification.
- **Filtering happens only at read time**: `useAdultFiltered({ items, idOf })` wraps the pure
  `AdultFilterTool.apply`. Caches, digests and the reducers keep the raw list. Dumb components get
  a `blurred` prop (cover `blurRadius`, text drawn as a shadow of itself — `blur` size tokens).
- Not covered: system (OS) notification text, and the global unread badge count.
