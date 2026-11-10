package com.mymangareader.notifications

import android.util.Log
import com.mymangareader.notifications.plugins.RawNotificationEvent
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "NotificationEventPipeline"

/**
 * The one place a raw plugin event turns into (or doesn't turn into) a posted notification —
 * `resolve` → `shouldNotify` → `isNewAtEnd` → `post`, exactly once per event, never duplicated inline inside
 * [com.mymangareader.NotificationConnectionService] (`android/app/`, Task 006). Extracted as its
 * own class specifically so this orchestration is testable with fakes, without needing a real
 * Android `Service` under Robolectric.
 */
@Singleton
class NotificationEventPipeline
    @Inject
    constructor(
        private val resolver: NotificationResolver,
        private val poster: NotificationPoster,
    ) {
        suspend fun handle(event: RawNotificationEvent) {
            Log.i(TAG, "handle() — event received: seriesId=${event.seriesId} slug=${event.slug} seriesName='${event.seriesName}'")

            val resolved = resolver.resolve(event)
            if (resolved == null) {
                Log.w(TAG, "handle() — event discarded: could not resolve to a local series")
                return
            }

            if (!resolver.shouldNotify(resolved)) {
                Log.i(TAG, "handle() — event resolved but not posted (out of notification scope): seriesId=${resolved.seriesId}")
                return
            }
            if (!resolver.isNewAtEnd(resolved)) {
                Log.i(TAG, "handle() — event resolved but not posted (not at the end of the series): seriesId=${resolved.seriesId}")
                return
            }
            Log.i(TAG, "handle() — posting notification for seriesId=${resolved.seriesId}")
            poster.post(resolved)
        }
    }
