package com.mymangareader.notifications

import com.mymangareader.core.database.CacheDao
import com.mymangareader.core.database.CacheEntity
import com.mymangareader.core.database.CacheKeyRef
import com.mymangareader.core.database.ServerGroupDao
import com.mymangareader.core.database.ServerGroupEntity
import com.mymangareader.core.database.ServerUrlDao
import com.mymangareader.core.database.ServerUrlEntity
import com.mymangareader.server.plugins.CredentialField
import com.mymangareader.server.plugins.PluginChapter
import com.mymangareader.server.plugins.PluginPageDimension
import com.mymangareader.server.plugins.PluginProgress
import com.mymangareader.server.plugins.PluginSerial
import com.mymangareader.server.plugins.PluginSeriesMetadata
import com.mymangareader.server.plugins.ServerPlugin
import com.mymangareader.server.plugins.ServerPluginRegistration
import com.mymangareader.tools.network.RequestTool
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

// Shared fakes for building a real Server instance in tests (NotificationResolverTest,
// NotificationGroupResolverTest) — one copy, not duplicated per test file (Kotlin's file-private
// visibility doesn't prevent a same-package name collision across files in the same Gradle
// source set).

class FakeServerGroupDao : ServerGroupDao {
    private val rows = mutableMapOf<String, ServerGroupEntity>()

    override suspend fun upsert(entity: ServerGroupEntity) {
        rows[entity.id] = entity
    }

    override suspend fun delete(entity: ServerGroupEntity) {
        rows.remove(entity.id)
    }

    override fun observeAll(): Flow<List<ServerGroupEntity>> = MutableStateFlow(rows.values.toList())

    override suspend fun getAll(): List<ServerGroupEntity> = rows.values.toList()

    override suspend fun getById(id: String): ServerGroupEntity? = rows[id]

    override suspend fun deleteById(id: String) {
        rows.remove(id)
    }
}

class FakeServerUrlDao : ServerUrlDao {
    private val rows = mutableMapOf<String, ServerUrlEntity>()

    override suspend fun upsert(entity: ServerUrlEntity) {
        rows[entity.id] = entity
    }

    override suspend fun delete(entity: ServerUrlEntity) {
        rows.remove(entity.id)
    }

    override fun observeByGroupId(groupId: String): Flow<List<ServerUrlEntity>> = MutableStateFlow(rows.values.filter { it.groupId == groupId }.sortedBy { it.priority })

    override suspend fun getByGroupId(groupId: String): List<ServerUrlEntity> = rows.values.filter { it.groupId == groupId }.sortedBy { it.priority }

    override suspend fun getById(id: String): ServerUrlEntity? = rows[id]

    override suspend fun deleteById(id: String) {
        rows.remove(id)
    }

    override suspend fun deleteByGroupId(groupId: String) {
        rows.values.filter { it.groupId == groupId }.forEach { rows.remove(it.id) }
    }
}

// In-memory CacheDao — just enough for a real Cache()/ActiveUrlSelector to construct against.
class FakeCacheDao : CacheDao {
    private data class MapKey(
        val key: String,
        val variant: String,
    )

    private val entities = mutableMapOf<MapKey, CacheEntity>()

    override suspend fun getByKey(
        key: String,
        variant: String,
    ): CacheEntity? = entities[MapKey(key, variant)]

    override suspend fun upsert(entity: CacheEntity) {
        entities[MapKey(entity.key, entity.variant)] = entity
    }

    override suspend fun keyRefsFiltered(
        keys: List<String>,
        hasKeys: Int,
        domain: String?,
        variant: String?,
    ): List<CacheKeyRef> = queryFiltered(keys, hasKeys, domain, variant).map { CacheKeyRef(it.key, it.variant) }

    override suspend fun queryFiltered(
        keys: List<String>,
        hasKeys: Int,
        domain: String?,
        variant: String?,
    ): List<CacheEntity> = emptyList()

    override suspend fun touchLastAccessed(
        key: String,
        variant: String,
        lastAccessedAtEpochMs: Long,
    ) = Unit

    override suspend fun deleteByKey(
        key: String,
        variant: String,
    ) = Unit

    override suspend fun deleteByDomain(domain: String) = Unit

    override suspend fun deleteByVariant(
        domain: String,
        variant: String,
    ) = Unit

    override suspend fun getAllExpired(nowEpochMs: Long): List<CacheEntity> = emptyList()

    override suspend fun getOlderThan(cutoffEpochMs: Long): List<CacheEntity> = emptyList()
}

class FakeServerPlugin(
    private val serialsList: List<PluginSerial> = emptyList(),
    private val chaptersList: List<PluginChapter> = emptyList(),
    private val chaptersFailure: Exception? = null,
) : ServerPlugin {
    override val id = "fake"
    override val displayName = "Fake"
    override val version = "0.0.0"

    override val auth =
        object : ServerPlugin.Auth {
            override suspend fun authenticate() = Unit

            override suspend fun checkToken(): String? = null

            override suspend fun reauthenticate() = Unit

            override suspend fun logout() = Unit

            override fun getSession(): String? = null
        }

    override val serials =
        object : ServerPlugin.Serials {
            override suspend fun list(): List<PluginSerial> = serialsList
        }

    override fun serial(serialId: String): ServerPlugin.Serial =
        object : ServerPlugin.Serial {
            override suspend fun get(): PluginSerial = serialsList.first { it.id == serialId }

            override suspend fun getMetadata(): PluginSeriesMetadata =
                PluginSeriesMetadata(
                    description = null,
                    genres = emptyList(),
                    tags = emptyList(),
                    publicationStatus = null,
                    ageRating = null,
                    releaseYear = null,
                    language = null,
                )

            override fun getCoverUrl(): String = ""

            override val chapters =
                object : ServerPlugin.Chapters {
                    override suspend fun list(): List<PluginChapter> = chaptersFailure?.let { throw it } ?: chaptersList

                    override suspend fun setRead(
                        isRead: Boolean,
                        chapterIds: List<String>,
                    ) = Unit
                }

            override fun chapter(chapterId: String): ServerPlugin.Chapter =
                object : ServerPlugin.Chapter {
                    override suspend fun get(): PluginChapter = throw UnsupportedOperationException()

                    override fun getCoverUrl(): String = ""

                    override suspend fun setRead(isRead: Boolean) = Unit

                    override suspend fun getProgress(): PluginProgress? = null

                    override suspend fun setProgress(pageIndex: Int) = Unit

                    override val pages = object : ServerPlugin.Pages {}

                    override fun page(pageIndex: Int): ServerPlugin.Page =
                        object : ServerPlugin.Page {
                            override suspend fun getDimensions(): PluginPageDimension = PluginPageDimension(width = 1, height = 1)

                            override fun getUrl(): String = ""
                        }
                }
        }
}

fun fakeSerial(
    id: String,
    name: String,
) = PluginSerial(
    id = id,
    name = name,
    coverUrl = "http://cover/$id",
    pagesRead = 0,
    totalPages = 0,
    libraryId = null,
    libraryName = null,
    lastFolderScannedUtc = null,
    lastChapterAddedUtc = null,
    latestReadDateUtc = null,
    originalName = null,
    localizedName = null,
    sortName = null,
    aniListId = null,
    malId = null,
    primaryColor = null,
    secondaryColor = null,
)

fun fakeRegistration(
    serials: List<PluginSerial> = emptyList(),
    chapters: List<PluginChapter> = emptyList(),
    chaptersFailure: Exception? = null,
): ServerPluginRegistration =
    object : ServerPluginRegistration {
        override val id = "fake"
        override val displayName = "Fake"
        override val version = "0.0.0"
        override val credentialFields =
            listOf(CredentialField("apiKey", "API Key", "string") { null })
        override val defaultHealthCheckPath = "/health"
        override val factory = { _: RequestTool, _: String, _: String ->
            FakeServerPlugin(serials, chapters, chaptersFailure) as ServerPlugin
        }
    }

fun fakeChapter(
    id: String,
    number: String?,
    isSpecial: Boolean = false,
) = PluginChapter(
    id = id,
    title = "Chapter $id",
    number = number,
    pageCount = 10,
    pagesRead = 0,
    isSpecial = isSpecial,
    decimalNumber = null,
    specialLabel = null,
    createdUtc = null,
    lastReadingProgressUtc = null,
    fileFormat = null,
)
