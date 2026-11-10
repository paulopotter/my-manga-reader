# Quick Start — load when you need commands/build/session info

---

## Development

```bash
# Validate environment and install dependencies
make setup

# Build debug APK (Kotlin shell)
make build-android

# Build JS bundle (React Native UI)
make build-bundle

# Install on physical device connected via USB
make deploy

# Stream app logs
make log

# Pull the app's own metrics (memory / CPU / battery / app state, every 5 min) + crash log +
# the system's dumpsys meminfo/batterystats into metrics/<date>/ (gitignored), then print the report.
# Needs a build that has the collector. Meant to be run after hours of normal use, then again
# after a change, so the two can be compared.
make metrics
make metrics-report                   # re-read a saved pull (DIR=metrics/<date>, default newest)
make metrics-compare                  # two newest pulls side by side (A=... B=... to choose)
python3 scripts/metrics-report.tests.py

# Run Android unit tests
cd android && ./gradlew test

# Run JS tests
cd frontend && yarn test

# List connected devices
adb devices

# Retake the docs screenshots on the device (covers → placeholder, titles → lorem ipsum,
# status bar painted over, Do Not Disturb on while it runs). Script: scripts/screenshots/shots.json
make screenshots
make screenshots ONLY=home            # one shot; OUT=/some/dir to keep docs/ untouched
python3 scripts/take-screenshots.tests.py
```

Testing always happens on a real physical device — never an emulator. The one exception is the
docs screenshots, which can be taken on an emulator (`make screenshots EMULATOR=1`) so a clean
install, a fixed theme and no personal notifications are possible.

Emulator on an Intel Mac with Hypervisor.framework (12th-gen+ CPUs): the Android 35 kernel panics at
boot on `TPAUSE` (WAITPKG). Boot it with the kernel told to ignore the feature — add to the
`emulator` command `-qemu -append "<default cmdline> clearcpuid=waitpkg"`, where the default is
`8250.nr_uarts=1 clocksource=pit no_timer_check console=ttyS0,38400 earlyprintk=ttyS0 ndns=2
loop.max_part=7 ramoops.mem_address=0xff018000 ramoops.mem_size=0x10000 memmap=0x10000$0xff018000
printk.devkmsg=on bootconfig`. Never `pkill qemu-system-x86_64`: other VMs (Docker) use that binary.

Before generating a build that goes to the user's device: apply the
`versionar-build` skill (adds `-rcN` suffix to APK `versionName` AND JS
`bundleVersion` until explicit approval).

---

## Environment configuration (`.env`)

`.env` (repo root, gitignored) is the single source of truth for build-time config — copy
`.env.example`, fill in your values. `make setup` and `make build-android` both run
`scripts/env-to-local-properties.sh`, which converts `.env` into `android/local.properties`
(Gradle's own config format) before the build starts. Idempotent: a run with unchanged `.env`
content is a no-op (no `local.properties` mtime churn).

`.env` itself is optional — if it's absent, the script only needs `$ANDROID_HOME` or
`$ANDROID_SDK_ROOT` in the shell to resolve the SDK path, and every other key is simply absent
from `local.properties` (features gated by missing config just stay off, per this project's own
rule — nothing crashes). It only fails if the SDK can't be resolved by any means.

Keys today: `ANDROID_SDK_DIR`, `KAVITA_URL`, `KAVITA_API_KEY`, `OTA_MANIFEST_URL`, `BFF_URL`,
`NOTIFICATION_PROVIDER`, `NTFY_URL`, `NTFY_TOPIC`, `DEEPLINK_HOSTS` (comma-separated, up to 5 —
expanded into `deeplink.host1`..`deeplink.host5` for `android/app/build.gradle.kts`'s
`generateDeepLinkHosts` task, which renders them into `AndroidManifest.xml`'s App Link
intent-filters). `OTA_MANIFEST_URL` also has a CI-only path: `.github/workflows/release.yml`
injects it as a real environment variable for the release build, bypassing `.env` entirely —
`android/app/build.gradle.kts` reads `local.properties` first, then falls back to
`System.getenv("OTA_MANIFEST_URL")`.

To add a new build-time variable: add it to `.env.example` (documented, no real value) and to
your own `.env`; `env-to-local-properties.sh` copies any unrecognized `KEY=value` line straight
through unless it needs a Gradle-specific transformation (like `DEEPLINK_HOSTS`'s expansion).

---

## Deep links

Two vocabularies meet here, and keeping them apart is the whole point:

- **The content server's web URLs** — what the user actually taps in a browser, Telegram, etc.
  Kavita serves a series with or without a library segment, and a chapter under `/manga/`, so all
  four shapes are registered in the manifest:

  | URL | opens |
  |---|---|
  | `/series/{seriesId}` | series screen |
  | `/library/{libraryId}/series/{seriesId}` | series screen |
  | `/series/{seriesId}/manga/{chapterId}` | reader |
  | `/library/{libraryId}/series/{seriesId}/manga/{chapterId}` | reader |

  The `libraryId` is Kavita's own grouping and means nothing to this app, which addresses a series
  by its id alone — so it's dropped during translation.

- **The app's internal routes** — `series/{id}` and `reader/{seriesId}/{chapterId}`, the names
  React Navigation knows. Also what the custom `mymangareader://` scheme speaks (a notification's
  own PendingIntent builds it that way).

`DeepLinkNormalizer` (`android/app/`) translates the first into the second and hands RN a
`deeplink://` URI. **That translation is Kotlin-only on purpose**: `linking.config.ts` only ever
knows the internal scheme, so supporting another server's URL shape — or another custom scheme —
never touches the RN side.

Paths live in `DEEP_LINK_PATH_PATTERNS` (`android/app/build.gradle.kts`) for the manifest and in
`internalRouteFor` (`DeepLinkNormalizer.kt`) for the translation — adding a shape means both.

### Why `autoVerify` isn't enough here

The generated block emits two intent-filters: http without `autoVerify`, https with it. They can
never share one, since verification only runs over https and only when every `<data>` in that
filter carries the attribute.

Even so, verification cannot pass for a Kavita host: it requires
`https://<host>/.well-known/assetlinks.json` naming this app's signing cert, and the domain
belongs to the server, not to us. The practical effect is that Android offers the app in the
"open with" chooser rather than opening it straight away. The `ACTION_SEND` filter
(`AndroidManifest.xml`) is the way around it — sharing a URL from any app reaches the same
normalizer. A bare IP never verifies either, by design on Android's side.

---

## OTA bundle

The JS bundle has its own version, independent of the APK version.
Both are bumped and tracked separately by `versionar-build`.

### Manifest fallback

`OTA_MANIFEST_URL` normally points at a local dev server (`make ota-*`, served over `adb reverse`)
— which only exists while that script runs. So a device carrying a dev build would otherwise never
see a real release: every check fails, silently, forever.

Two flags decide whether the project's own releases URL is consulted when the configured manifest
doesn't deliver. Both default to true (including when the key is present but empty):

| flag | fires when |
|---|---|
| `OTA_FALLBACK_ON_ERROR` | the configured manifest couldn't be reached or parsed |
| `OTA_FALLBACK_ON_NO_UPDATE` | it answered, and said there's nothing new — tried after the one above |

**The fallback can only ever move forward.** A release is accepted only when its `lastAppVersion`
is strictly newer than the running install's, so it never overwrites a freshly deployed local
build or a bundle being tested. Anything failing mid-way (either manifest down, an unparseable
version) leaves the working bundle exactly as it was.

This is why `scripts/ota-serve.sh` stamps the **real** UTC datetime into `lastAppVersion` rather
than a fixed sentinel: that field is what the comparison reads. The other sentinels in that script
are deliberate and stay (`minKotlinVersion: 0.0.0` so the technical check never blocks, a policy
`minVersion` of `9999.99.99` so the policy always fires).

### Manifest fields

| field | means | read by |
|---|---|---|
| `lastRNVersion` | the published bundle's version | decides whether to download it |
| `url` / `bundleHash` | where the bundle is, and its sha256 | download + integrity check |
| `bundleBuildTimeMs` | when the bundle was built | discards an OTA bundle older than the packaged one (after a `make redeploy`) |
| `lastAppVersion` | the release tag (`YYYY.MM.DD.HHMM`) | the fallback's "is this newer than what's installed?" guard |
| `minKotlinVersion` | oldest native version the bundle runs on | **blocks** anything below it |
| `lastKotlinVersion` | native version this release ships | nothing yet — see below |
| `policies` | required / recommended levels | blocks or advises |

`lastKotlinVersion` exists because of an asymmetry: a new **bundle** arrives on its own (OTA
downloads it, no user effort), while new **native** code only arrives by installing an APK — which
the user has to do by hand. Comparing it against the running install is how the app can tell there
is an APK worth installing.

`lastAppVersion` can't answer that: it advances on every release, including JS-only ones the OTA
already applied, so it can't separate "there's something for you to do" from "nothing left to do".

Nothing reads `lastKotlinVersion` yet — it's published so an in-app notice has the data when that
gets built.

### What makes an update mandatory

Two manifest fields can stop the app, and only one of them is a decision about releases:

| field | means | set by |
|---|---|---|
| `policies` | "this update is required / recommended" | you, via `policy-pending.json` |
| `minKotlinVersion` | "this bundle needs at least this much native code" | a hand-edited constant in `release.yml` |

`minKotlinVersion` used to be filled with the release's own `versionName`. Those are different
things: the result was that every release declared "you must be on exactly this version", blocking
anyone who hadn't installed it yet — with `policy-pending.json` empty and nobody asking for it.

It is now a constant (`MIN_KOTLIN` in the release workflow), raised by hand only when a bundle
genuinely stops working on older native code. Wanting people on a newer build is what the policy
levels are for; a hard block is only correct when an OTA bundle physically cannot run on what's
installed, since no bundle can update native code.

---

## Sessions and completions

- `.claude/sessions/active/` — plans in progress. Each plan is one folder:
  `README.md` (the plan) + `INDEX.md` (task table) + numbered task files.
- `.claude/completions/` — finished work:
  - One doc per finished task: `[YYYY-MM-DD]_NNN-task-name.md`
  - `.claude/completions/archive/` — whole plan folders once every task is done
- Neither is ever auto-loaded.
- Always translate to English when archiving.

Templates: `.claude/templates/`

---

## Release cycle

See `.claude/docs/release-cycle.md` for:
- How to write `[Unreleased]` bullets
- Versioning rules (app tag, Kotlin semver, RN semver)
- How to trigger an RC build via PR comment
- Which secrets are required

---

**Last Updated**: 2026-08-10
