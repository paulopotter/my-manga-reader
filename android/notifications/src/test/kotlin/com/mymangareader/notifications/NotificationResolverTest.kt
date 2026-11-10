package com.mymangareader.notifications

import com.mymangareader.cache.Cache
import com.mymangareader.core.database.BffMatchEntity
import com.mymangareader.core.database.FollowedSeriesDao
import com.mymangareader.core.database.FollowedSeriesEntity
import com.mymangareader.core.database.ServerGroupEntity
import com.mymangareader.core.database.ServerUrlEntity
import com.mymangareader.notifications.plugins.RawNotificationEvent
import com.mymangareader.preferences.Preferences
import com.mymangareader.server.Server
import com.mymangareader.server.plugins.PluginSerial
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

// ── Fakes specific to this test (ServerGroupDao/ServerUrlDao/CacheDao/ServerPlugin fakes and
// fakeSerial/fakeRegistration live in ServerTestFakes.kt, shared with NotificationGroupResolverTest) ──

private class FakeFollowedSeriesDao : FollowedSeriesDao {
    private val ids = mutableSetOf<String>()

    override suspend fun getAllIds(): List<String> = ids.toList()

    override fun observeAllIds(): Flow<List<String>> = MutableStateFlow(ids.toList())

    override suspend fun isFollowed(seriesId: String): Boolean = seriesId in ids

    override suspend fun follow(entity: FollowedSeriesEntity) {
        ids += entity.seriesId
    }

    override suspend fun unfollow(seriesId: String) {
        ids -= seriesId
    }
}

// FakePreferenceDao lives in NotificationTestFakes.kt, shared across this module's tests.

// ── Tests ──────────────────────────────────────────────────────────────────

class NotificationResolverTest {
    private lateinit var mockServer: MockWebServer
    private lateinit var followedSeriesDao: FakeFollowedSeriesDao
    private lateinit var bffMatchDao: FakeBffMatchDao
    private lateinit var preferences: Preferences
    private var channelEnabled = true
    private lateinit var resolver: NotificationResolver

    private suspend fun activateGroup(
        server: Server,
        groupDao: FakeServerGroupDao,
        urlDao: FakeServerUrlDao,
    ) {
        val group = ServerGroupEntity(id = "g1", name = "Test", providerId = "fake", credentialsJson = "{}", healthCheckPath = "/health")
        groupDao.upsert(group)
        urlDao.upsert(ServerUrlEntity(id = "u1", groupId = "g1", url = mockServer.url("/").toString().trimEnd('/'), timeoutMs = 5_000, priority = 0))
        mockServer.enqueue(MockResponse().setResponseCode(200).setBody("OK"))
        server.setActiveGroup("g1")
    }

    private suspend fun buildResolver(
        serials: List<PluginSerial> = listOf(fakeSerial("1", "One Piece")),
        chapters: List<com.mymangareader.server.plugins.PluginChapter> = emptyList(),
        chaptersFailure: Exception? = null,
    ): NotificationResolver {
        val groupDao = FakeServerGroupDao()
        val urlDao = FakeServerUrlDao()
        val cache = Cache(FakeCacheDao())
        val server =
            Server(
                groupDao,
                urlDao,
                mapOf("fake" to fakeRegistration(serials, chapters, chaptersFailure)),
                ActiveUrlSelector(OkHttpClient(), cache),
                RequestTool(OkHttpClient()),
            )
        activateGroup(server, groupDao, urlDao)
        followedSeriesDao = FakeFollowedSeriesDao()
        bffMatchDao = FakeBffMatchDao()
        preferences = Preferences(FakePreferenceDao())
        channelEnabled = true
        return NotificationResolver(server, followedSeriesDao, bffMatchDao, preferences, NotificationChannelState { channelEnabled })
    }

    @Before
    fun setUp() {
        mockServer = MockWebServer()
        mockServer.start()
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
    }

    // ── resolve ──

    @Test
    fun `resolve com seriesId presente pula a busca por nome`() =
        runTest {
            resolver = buildResolver(serials = emptyList())

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = "42", seriesName = "Anything", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertEquals("42", resolved?.seriesId)
        }

    @Test
    fun `resolve por seriesName com exatamente 1 match resolve`() =
        runTest {
            resolver = buildResolver(serials = listOf(fakeSerial("1", "One Piece")))
            mockServer.enqueue(MockResponse().setResponseCode(200).setBody("[]"))

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = null, seriesName = "One Piece", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertEquals("1", resolved?.seriesId)
        }

    @Test
    fun `resolve por seriesName com zero matches descarta o evento`() =
        runTest {
            resolver = buildResolver(serials = listOf(fakeSerial("1", "One Piece")))
            mockServer.enqueue(MockResponse().setResponseCode(200).setBody("[]"))

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = null, seriesName = "Missing", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertNull(resolved)
        }

    @Test
    fun `resolve por seriesName com mais de 1 match descarta o evento`() =
        runTest {
            resolver = buildResolver(serials = listOf(fakeSerial("1", "Dup"), fakeSerial("2", "Dup")))
            mockServer.enqueue(MockResponse().setResponseCode(200).setBody("[]"))

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = null, seriesName = "Dup", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertNull(resolved)
        }

    @Test
    fun `resolve com seriesId ausente mas slug com match usa o seriesId do BffMatchDao, sem consultar seriesName`() =
        runTest {
            resolver = buildResolver(serials = emptyList())
            bffMatchDao.insertAll(
                listOf(
                    BffMatchEntity(
                        seriesId = "7",
                        slug = "one-piece",
                        status = "matched",
                        downloadedChapters = null,
                        totalChapters = null,
                        latestChapterLabel = null,
                        hasErrors = false,
                        updatedAtLocalMs = 0L,
                    ),
                ),
            )

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = null, seriesName = "Anything", slug = "one-piece", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertEquals("7", resolved?.seriesId)
        }

    @Test
    fun `resolve com slug sem match no BffMatchDao cai para a busca por seriesName`() =
        runTest {
            resolver = buildResolver(serials = listOf(fakeSerial("1", "One Piece")))
            mockServer.enqueue(MockResponse().setResponseCode(200).setBody("[]"))

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = null, seriesName = "One Piece", slug = "unknown-slug", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertEquals("1", resolved?.seriesId)
        }

    @Test
    fun `resolve com seriesId presente ignora slug, mesmo que o slug tenha match diferente`() =
        runTest {
            resolver = buildResolver(serials = emptyList())
            bffMatchDao.insertAll(
                listOf(
                    BffMatchEntity(
                        seriesId = "7",
                        slug = "one-piece",
                        status = "matched",
                        downloadedChapters = null,
                        totalChapters = null,
                        latestChapterLabel = null,
                        hasErrors = false,
                        updatedAtLocalMs = 0L,
                    ),
                ),
            )

            val resolved =
                resolver.resolve(
                    RawNotificationEvent(seriesId = "42", seriesName = "Anything", slug = "one-piece", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L),
                )

            assertEquals("42", resolved?.seriesId)
        }

    // ── shouldNotify ──

    private fun resolvedEvent(seriesId: String = "1") = ResolvedSeriesEvent(seriesId = seriesId, seriesName = "One Piece", chapterIds = null, chapterNumbers = null, detectedAtMs = 1_000L)

    @Test
    fun `shouldNotify e false quando o canal esta desabilitado, mesmo com scopeAll true`() =
        runTest {
            resolver = buildResolver()
            channelEnabled = false
            preferences.put("scopeAll", "true", domain = "notifications")

            assertFalse(resolver.shouldNotify(resolvedEvent()))
        }

    @Test
    fun `shouldNotify e true quando o canal esta habilitado e scopeAll true, independente de Following`() =
        runTest {
            resolver = buildResolver()
            preferences.put("scopeAll", "true", domain = "notifications")

            assertTrue(resolver.shouldNotify(resolvedEvent()))
        }

    @Test
    fun `shouldNotify e true quando o canal esta habilitado e scopeFollowedOnly true e a serie esta seguida`() =
        runTest {
            resolver = buildResolver()
            followedSeriesDao.follow(FollowedSeriesEntity(seriesId = "1", followedAtMs = 0))
            preferences.put("scopeFollowedOnly", "true", domain = "notifications")

            assertTrue(resolver.shouldNotify(resolvedEvent(seriesId = "1")))
        }

    @Test
    fun `shouldNotify e false quando scopeFollowedOnly true mas a serie nao esta seguida`() =
        runTest {
            resolver = buildResolver()
            preferences.put("scopeFollowedOnly", "true", domain = "notifications")

            assertFalse(resolver.shouldNotify(resolvedEvent(seriesId = "1")))
        }

    @Test
    fun `shouldNotify e false quando o canal esta habilitado mas nenhum scope esta ligado`() =
        runTest {
            resolver = buildResolver()

            assertFalse(resolver.shouldNotify(resolvedEvent()))
        }

    @Test
    fun `shouldNotify e true quando os dois scopes estao true, tratado como notificar tudo`() =
        runTest {
            resolver = buildResolver()
            preferences.put("scopeAll", "true", domain = "notifications")
            preferences.put("scopeFollowedOnly", "true", domain = "notifications")

            assertTrue(resolver.shouldNotify(resolvedEvent()))
        }

    // ── isNewAtEnd ──

    private fun event(
        numbers: List<String>?,
        ids: List<String>? = null,
    ) = ResolvedSeriesEvent(seriesId = "1", seriesName = "One Piece", chapterIds = ids, chapterNumbers = numbers, detectedAtMs = 1_000L)

    private fun hundredChapters() = (1..100).map { fakeChapter("c$it", it.toString()) }

    @Test
    fun `isNewAtEnd rejeita capitulo que so preenche buraco numa obra que ja tem mais`() =
        runTest {
            resolver = buildResolver(chapters = hundredChapters())
            assertFalse(resolver.isNewAtEnd(event(numbers = listOf("25"), ids = listOf("c25"))))
        }

    @Test
    fun `isNewAtEnd aceita capitulo acima do maior que a obra ja tinha`() =
        runTest {
            resolver = buildResolver(chapters = (1..40).map { fakeChapter("c$it", it.toString()) } + fakeChapter("c41", "41"))
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("41"), ids = listOf("c41"))))
        }

    @Test
    fun `isNewAtEnd ignora o proprio capitulo do evento mesmo sem ids, comparando por numero`() =
        runTest {
            resolver = buildResolver(chapters = (1..61).map { fakeChapter("c$it", it.toString()) })
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("61"))))
            assertFalse(resolver.isNewAtEnd(event(numbers = listOf("25"))))
        }

    @Test
    fun `isNewAtEnd com varios capitulos no evento usa o maior deles`() =
        runTest {
            resolver = buildResolver(chapters = hundredChapters() + fakeChapter("c101", "101"))
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("25", "101"), ids = listOf("c25", "c101"))))
        }

    @Test
    fun `isNewAtEnd notifica quando nao ha o que comparar`() =
        runTest {
            resolver = buildResolver(chapters = hundredChapters())
            assertTrue(resolver.isNewAtEnd(event(numbers = null)))
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("Extra"))))

            resolver = buildResolver(chapters = emptyList())
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("25"))))
        }

    @Test
    fun `isNewAtEnd ignora especiais ao achar o maior capitulo conhecido`() =
        runTest {
            resolver = buildResolver(chapters = listOf(fakeChapter("c10", "10"), fakeChapter("s1", "999", isSpecial = true)))
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("11"), ids = listOf("c11"))))
        }

    @Test
    fun `isNewAtEnd notifica quando o servidor nao consegue listar os capitulos`() =
        runTest {
            resolver = buildResolver(chaptersFailure = IllegalStateException("offline"))
            assertTrue(resolver.isNewAtEnd(event(numbers = listOf("25"), ids = listOf("c25"))))
        }
}
