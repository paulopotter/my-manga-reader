package com.mymangareader.notifications

import android.util.Log
import com.mymangareader.core.database.BffMatchDao
import com.mymangareader.core.database.FollowedSeriesDao
import com.mymangareader.notifications.plugins.RawNotificationEvent
import com.mymangareader.preferences.Preferences
import com.mymangareader.server.Server
import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "NotificationResolver"

/**
 * One series-level event already resolved to a local `seriesId` — [RawNotificationEvent] before
 * this only carries `seriesId?`/`seriesName`, either of which might not exist locally yet.
 */
data class ResolvedSeriesEvent(
    val seriesId: String,
    val seriesName: String,
    val chapterIds: List<String>?,
    val chapterNumbers: List<String>?,
    val detectedAtMs: Long,
)

/**
 * Resolves a raw ntfy event to a local series (Task 002's [RawNotificationEvent] carries an
 * *unresolved* `seriesId?`/`seriesName` pair) and decides whether that resolved event should
 * actually become a visible notification — README decisions 5 and 6. Runs entirely in Kotlin,
 * ahead of [com.mymangareader.notifications.plugins.ntfy.NtfyPlugin]'s foreground-service
 * consumer (Task 006), with no RN involvement in this hot path.
 */
@Singleton
class NotificationResolver
    @Inject
    constructor(
        private val server: Server,
        private val followedSeriesDao: FollowedSeriesDao,
        private val bffMatchDao: BffMatchDao,
        private val preferences: Preferences,
        private val channelState: NotificationChannelState,
    ) {
        // [seriesId] present → resolved directly, no network/listing lookup, no local-existence
        // check — the server's own id is the base value a publisher is expected to send when it
        // knows it (e.g. it already resolved the series against the same server this app talks
        // to), and this resolver trusts it as-is, same as before slug support existed.
        //
        // [seriesId] absent → two AIDS are tried, in order, never as a substitute for seriesId,
        // only to help find it when it wasn't sent:
        //  1. [RawNotificationEvent.slug] against BffMatchDao's own slug column — this is the
        //     external-matching identifier a legacy publisher already knows (see
        //     PAYLOAD_CONTRACT's own "slug → seriesId via matching" step); only ever consulted,
        //     never required — most publishers never send it, and a series with no BFF match yet
        //     simply has no row to find here.
        //  2. Exact [seriesName] match against the series listing Server already exposes (same
        //     data SerialsService.list reaches on the RN side) — never re-fetched/re-derived by
        //     this resolver itself, per the "ask the domain, don't recompute it" rule. Exactly one
        //     match → resolved; zero or more than one → discarded (null), never guessed.
        // Neither aid resolves → discarded (null).
        suspend fun resolve(event: RawNotificationEvent): ResolvedSeriesEvent? {
            Log.d(TAG, "resolve() — seriesId=${event.seriesId} slug=${event.slug} seriesName=${event.seriesName}")

            if (event.seriesId != null) {
                Log.i(TAG, "resolve() — using seriesId=${event.seriesId} as-is (sent by the publisher)")
                return event.toResolved(event.seriesId)
            }

            resolveBySlug(event.slug)?.let { seriesId ->
                Log.i(TAG, "resolve() — resolved via slug '${event.slug}' -> seriesId=$seriesId")
                return event.toResolved(seriesId)
            }

            resolveBySeriesName(event.seriesName)?.let { seriesId ->
                Log.i(TAG, "resolve() — resolved via seriesName '${event.seriesName}' -> seriesId=$seriesId")
                return event.toResolved(seriesId)
            }

            Log.w(TAG, "resolve() — could not resolve event (no seriesId, no slug match, no unique seriesName match) — discarding: seriesName='${event.seriesName}' slug=${event.slug}")
            return null
        }

        private fun RawNotificationEvent.toResolved(seriesId: String) =
            ResolvedSeriesEvent(
                seriesId = seriesId,
                seriesName = seriesName,
                chapterIds = chapterIds,
                chapterNumbers = chapterNumbers,
                detectedAtMs = detectedAtMs,
            )

        private suspend fun resolveBySlug(slug: String?): String? {
            if (slug.isNullOrBlank()) return null
            return bffMatchDao.getAll().firstOrNull { it.slug == slug }?.seriesId
        }

        private suspend fun resolveBySeriesName(seriesName: String): String? {
            val matches = server.serials.list().data.serials.filter { it.name == seriesName }
            if (matches.size > 1) {
                Log.w(TAG, "resolveBySeriesName() — ${matches.size} series match '$seriesName', ambiguous, discarding")
            }
            return matches.singleOrNull()?.id
        }

        // false unless the Android notification channel is enabled (Task 007 — the channel's own
        // state is the one source of truth for "enabled", never a :preferences flag that could
        // drift out of sync with it). Otherwise true if scopeAll is true, or (the series is in
        // Following AND scopeFollowedOnly is true) — see README decision 6. scopeAll/
        // scopeFollowedOnly are UI-level mutually exclusive (Task 008 enforces that in the config
        // screen), but this function never assumes that invariant: both true is evaluated as
        // written below, which simply behaves as "notify all".
        suspend fun shouldNotify(resolved: ResolvedSeriesEvent): Boolean {
            if (!channelState.isEnabled()) {
                Log.i(TAG, "shouldNotify() — IGNORED seriesId=${resolved.seriesId}: channel disabled")
                return false
            }
            if (readFlag(NotificationPreferenceKeys.SCOPE_ALL)) {
                Log.i(TAG, "shouldNotify() — NOTIFY seriesId=${resolved.seriesId}: scopeAll enabled")
                return true
            }
            if (!readFlag(NotificationPreferenceKeys.SCOPE_FOLLOWED_ONLY)) {
                Log.i(TAG, "shouldNotify() — IGNORED seriesId=${resolved.seriesId}: no scope enabled (scopeAll and scopeFollowedOnly both off)")
                return false
            }
            val followed = followedSeriesDao.isFollowed(resolved.seriesId)
            Log.i(
                TAG,
                "shouldNotify() — ${if (followed) "NOTIFY" else "IGNORED"} seriesId=${resolved.seriesId}: " +
                    "scopeFollowedOnly enabled, followed=$followed",
            )
            return followed
        }

        // Whether the event brings a chapter at the END of the series — a number above the highest one the
        // series already had on the server. A chapter that only fills a gap (chapter 25 turning up in a
        // series that already has 100) is old news and not worth a notification. The series' own chapters
        // that the event announces are left out of the comparison (by id and by number), since by the
        // time the event arrives the server already lists them.
        //
        // Fails open: nothing to compare (no numeric chapter number in the event, no other numbered
        // chapter on the server, a special) or a server that cannot be asked → true, so a notification
        // is never lost to this check.
        suspend fun isNewAtEnd(resolved: ResolvedSeriesEvent): Boolean {
            val eventNumbers = resolved.chapterNumbers.orEmpty().mapNotNull { it.toDoubleOrNull() }
            if (eventNumbers.isEmpty()) return true
            val eventIds = resolved.chapterIds.orEmpty().toSet()
            val knownHighest =
                try {
                    server
                        .serial(resolved.seriesId)
                        .chapters
                        .list()
                        .data
                        .asSequence()
                        .filter { it.isSpecial != true && it.id !in eventIds }
                        .mapNotNull { it.decimalNumber ?: it.number?.toDoubleOrNull() }
                        .filter { it !in eventNumbers }
                        .maxOrNull()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.w(TAG, "isNewAtEnd() — could not list chapters of seriesId=${resolved.seriesId}, notifying anyway: ${e.message}")
                    return true
                } ?: return true
            val atEnd = eventNumbers.max() > knownHighest
            Log.i(TAG, "isNewAtEnd() — seriesId=${resolved.seriesId} event=${eventNumbers.max()} knownHighest=$knownHighest atEnd=$atEnd")
            return atEnd
        }

        private suspend fun readFlag(key: String): Boolean = preferences.get(key)?.value == "true"
    }
