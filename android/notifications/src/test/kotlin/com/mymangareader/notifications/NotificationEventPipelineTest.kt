package com.mymangareader.notifications

import com.mymangareader.cache.Cache
import com.mymangareader.core.database.FollowedSeriesDao
import com.mymangareader.core.database.FollowedSeriesEntity
import com.mymangareader.core.database.PreferenceDao
import com.mymangareader.core.database.PreferenceEntity
import com.mymangareader.notifications.plugins.RawNotificationEvent
import com.mymangareader.preferences.Preferences
import com.mymangareader.server.Server
import com.mymangareader.tools.network.ActiveUrlSelector
import com.mymangareader.tools.network.RequestTool
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

private class FakeFollowedSeriesDaoForPipeline : FollowedSeriesDao {
    override suspend fun getAllIds(): List<String> = emptyList()

    override fun observeAllIds(): Flow<List<String>> = MutableStateFlow(emptyList())

    override suspend fun isFollowed(seriesId: String): Boolean = true

    override suspend fun follow(entity: FollowedSeriesEntity) = Unit

    override suspend fun unfollow(seriesId: String) = Unit
}

private class FakePreferenceDaoForPipeline : PreferenceDao {
    private val rows = mutableMapOf<String, PreferenceEntity>()

    override suspend fun getByKey(
        key: String,
        variant: String,
    ): PreferenceEntity? = rows["$key:$variant"]

    override suspend fun upsert(entity: PreferenceEntity) {
        rows["${entity.key}:${entity.variant}"] = entity
    }

    override suspend fun deleteByKey(
        key: String,
        variant: String,
    ) {
        rows.remove("$key:$variant")
    }

    override suspend fun deleteByDomain(domain: String) {
        rows.values.filter { it.domain == domain }.forEach { rows.remove("${it.key}:${it.variant}") }
    }
}

private class RecordingNotificationPoster : NotificationPoster {
    val posted = mutableListOf<ResolvedSeriesEvent>()

    override suspend fun post(resolved: ResolvedSeriesEvent) {
        posted += resolved
    }
}

class NotificationEventPipelineTest {
    private lateinit var mockServer: MockWebServer
    private lateinit var preferences: Preferences
    private var channelEnabled = true
    private lateinit var poster: RecordingNotificationPoster
    private lateinit var pipeline: NotificationEventPipeline

    @Before
    fun setUp() {
        mockServer = MockWebServer()
        mockServer.start()
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
    }

    private suspend fun buildPipeline(
        serials: List<com.mymangareader.server.plugins.PluginSerial> = emptyList(),
        chapters: List<com.mymangareader.server.plugins.PluginChapter> = emptyList(),
    ): NotificationEventPipeline {
        val groupDao = FakeServerGroupDao()
        val urlDao = FakeServerUrlDao()
        val cache = Cache(FakeCacheDao())
        val server =
            Server(
                groupDao,
                urlDao,
                mapOf("fake" to fakeRegistration(serials, chapters)),
                ActiveUrlSelector(OkHttpClient(), cache),
                RequestTool(OkHttpClient()),
            )
        groupDao.upsert(
            com.mymangareader.core.database.ServerGroupEntity(
                id = "g1",
                name = "Test",
                providerId = "fake",
                credentialsJson = "{}",
                healthCheckPath = "/health",
            ),
        )
        urlDao.upsert(
            com.mymangareader.core.database.ServerUrlEntity(
                id = "u1",
                groupId = "g1",
                url = mockServer.url("/").toString().trimEnd('/'),
                timeoutMs = 5_000,
                priority = 0,
            ),
        )
        mockServer.enqueue(MockResponse().setResponseCode(200).setBody("OK"))
        server.setActiveGroup("g1")

        preferences = Preferences(FakePreferenceDaoForPipeline())
        channelEnabled = true
        val resolver = NotificationResolver(server, FakeFollowedSeriesDaoForPipeline(), FakeBffMatchDao(), preferences, NotificationChannelState { channelEnabled })
        poster = RecordingNotificationPoster()
        return NotificationEventPipeline(resolver, poster)
    }

    @Test
    fun `evento resolvido e permitido chega ao poster exatamente uma vez`() =
        runTest {
            pipeline = buildPipeline()
            preferences.put("scopeAll", "true", domain = "notifications")

            pipeline.handle(
                RawNotificationEvent(seriesId = "42", seriesName = "One Piece", chapterIds = listOf("101"), chapterNumbers = listOf("1120"), detectedAtMs = 1_000L),
            )

            assertEquals(1, poster.posted.size)
            assertEquals("42", poster.posted.single().seriesId)
        }

    @Test
    fun `evento nao resolvido nunca chega ao poster`() =
        runTest {
            pipeline = buildPipeline(serials = emptyList())
            preferences.put("scopeAll", "true", domain = "notifications")

            pipeline.handle(
                RawNotificationEvent(seriesId = null, seriesName = "Unknown series", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
            )

            assertTrue(poster.posted.isEmpty())
        }

    @Test
    fun `evento resolvido mas filtrado por shouldNotify nunca chega ao poster`() =
        runTest {
            pipeline = buildPipeline()
            channelEnabled = false

            pipeline.handle(
                RawNotificationEvent(seriesId = "42", seriesName = "One Piece", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
            )

            assertTrue(poster.posted.isEmpty())
        }

    @Test
    fun `multiplos eventos cada um chega ao poster exatamente uma vez, na ordem`() =
        runTest {
            pipeline = buildPipeline()
            preferences.put("scopeAll", "true", domain = "notifications")

            pipeline.handle(RawNotificationEvent(seriesId = "1", seriesName = "A", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L))
            pipeline.handle(RawNotificationEvent(seriesId = "2", seriesName = "B", chapterIds = null, chapterNumbers = null, detectedAtMs = 2_000L))

            assertEquals(listOf("1", "2"), poster.posted.map { it.seriesId })
        }

    @Test
    fun `evento de capitulo antigo numa obra mais longa nunca chega ao poster`() =
        runTest {
            pipeline = buildPipeline(chapters = (1..100).map { fakeChapter("c$it", it.toString()) })
            preferences.put("scopeAll", "true", domain = "notifications")

            pipeline.handle(
                RawNotificationEvent(seriesId = "42", seriesName = "One Piece", chapterIds = listOf("c25"), chapterNumbers = listOf("25"), detectedAtMs = 1_000L),
            )

            assertTrue(poster.posted.isEmpty())
        }

    @Test
    fun `evento de capitulo novo no final da obra chega ao poster`() =
        runTest {
            pipeline = buildPipeline(chapters = (1..101).map { fakeChapter("c$it", it.toString()) })
            preferences.put("scopeAll", "true", domain = "notifications")

            pipeline.handle(
                RawNotificationEvent(seriesId = "42", seriesName = "One Piece", chapterIds = listOf("c101"), chapterNumbers = listOf("101"), detectedAtMs = 1_000L),
            )

            assertEquals(1, poster.posted.size)
        }
}
