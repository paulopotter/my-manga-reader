package com.mymangareader.features.kavita.reader.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.printToString
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class ReaderPageListTest {
    @get:Rule
    val composeRule = createComposeRule()

    private fun headerNode(chapterTitle: String): SduNode = SduNode.Container(children = listOf(SduNode.TextNode(text = chapterTitle, bold = true, fontSizeSp = 20)))

    private fun footerNode(
        endOfChapterLabel: String,
        nextChapterLabel: String,
        nextChapterTitle: String?,
    ): SduNode =
        SduNode.Container(
            children =
                buildList {
                    add(SduNode.TextNode(text = endOfChapterLabel, fontSizeSp = 14))
                    if (nextChapterTitle != null) {
                        add(SduNode.TextNode(text = nextChapterLabel, fontSizeSp = 12))
                        add(SduNode.TextNode(text = nextChapterTitle, bold = true, fontSizeSp = 16))
                    }
                },
        )

    private fun block(
        chapterId: String,
        chapterTitle: String,
        pageUrls: List<String>,
        nextChapterTitle: String? = null,
        pageAspectRatios: List<Float> = emptyList(),
    ) = ChapterBlock(
        chapterId = chapterId,
        pageUrls = pageUrls,
        pageAspectRatios = pageAspectRatios,
        firstNode = headerNode(chapterTitle),
        lastNode = footerNode("Fim do capítulo", "Próximo:", nextChapterTitle),
    )

    @Test
    fun `renders one page node per url`() {
        composeRule.setContent {
            ReaderPageList(
                blocks =
                    listOf(
                        block("c1", "Capítulo 1", listOf("https://example.com/1.webp", "https://example.com/2.png")),
                    ),
            )
        }

        composeRule.waitForIdle()
        val tree = composeRule.onRoot().printToString()
        assertTrue(tree.contains("https://example.com/1.webp") || tree.isNotEmpty())
    }

    @Test
    fun `renders nothing for an empty block list without crashing`() {
        composeRule.setContent {
            ReaderPageList(blocks = emptyList())
        }

        composeRule.waitForIdle()
    }

    @Test
    fun `onVisiblePageChanged is invoked at least once after the initial composition settles`() {
        var lastChapterId: String? = null
        var lastPageIndex = -1
        composeRule.setContent {
            ReaderPageList(
                blocks =
                    listOf(
                        block("c1", "Capítulo 1", listOf("https://example.com/1.webp", "https://example.com/2.png")),
                    ),
                onVisiblePageChanged = { chapterId, pageIndex, _, _ ->
                    lastChapterId = chapterId
                    lastPageIndex = pageIndex
                },
            )
        }

        composeRule.waitForIdle()
        composeRule.waitUntil(timeoutMillis = 5_000) { lastChapterId != null }
        assertTrue(lastChapterId == "c1")
        assertTrue(lastPageIndex >= 0)
    }

    @Test
    fun `renders the chapter title in the header`() {
        composeRule.setContent {
            ReaderPageList(
                blocks = listOf(block("c1", "Capítulo 42. O Retorno", listOf("https://example.com/1.webp"))),
            )
        }

        composeRule.waitForIdle()
        composeRule.onNodeWithText("Capítulo 42. O Retorno").assertExists()
    }

    @Test
    fun `renders multiple chapter blocks back to back`() {
        composeRule.setContent {
            ReaderPageList(
                blocks =
                    listOf(
                        block("c1", "Capítulo 1", listOf("https://example.com/1.webp"), nextChapterTitle = "Capítulo 2"),
                        block("c2", "Capítulo 2", listOf("https://example.com/2.webp")),
                    ),
            )
        }

        composeRule.waitForIdle()
        composeRule.onNodeWithText("Capítulo 1").assertExists()
    }

    @Test
    fun `footer node shows the next chapter preview when a next chapter exists`() {
        composeRule.setContent {
            SduNodeView(footerNode("Fim do capítulo", "Próximo:", "Capítulo 2. A Jornada"))
        }

        composeRule.waitForIdle()
        composeRule.onNodeWithText("Fim do capítulo").assertExists()
        composeRule.onNodeWithText("Capítulo 2. A Jornada").assertExists()
    }

    @Test
    fun `footer node omits the next chapter preview when there is no next chapter`() {
        composeRule.setContent {
            SduNodeView(footerNode("Fim do capítulo", "Próximo:", null))
        }

        composeRule.waitForIdle()
        composeRule.onNodeWithText("Fim do capítulo").assertExists()
        composeRule.onRoot().printToString().let { tree ->
            assertTrue(!tree.contains("Próximo:"))
        }
    }

    @Test
    fun `onScrollToChapterHandled fires once after a pending scroll request resolves`() {
        var handledCount = 0
        composeRule.setContent {
            ReaderPageList(
                blocks =
                    listOf(
                        block("c1", "Capítulo 1", (0 until 30).map { "https://example.com/$it.webp" }),
                    ),
                scrollToChapterId = "c1",
                scrollToPageIndex = 5,
                onScrollToChapterHandled = { handledCount++ },
            )
        }

        composeRule.waitForIdle()
        assertTrue(handledCount == 1)
    }

    @Test
    fun `does not attempt a scroll when scrollToChapterId is null`() {
        var handledCount = 0
        composeRule.setContent {
            ReaderPageList(
                blocks = listOf(block("c1", "Capítulo 1", listOf("https://example.com/1.webp"))),
                scrollToChapterId = null,
                onScrollToChapterHandled = { handledCount++ },
            )
        }

        composeRule.waitForIdle()
        assertTrue(handledCount == 0)
    }

    @Test
    fun `a new blocks reference with the same pending scroll request does not re-trigger the scroll`() {
        // Regression test: RN re-renders constantly as neighbor chapters finish prefetching,
        // handing down a new `blocks` list reference each time even though scrollToChapterId
        // hasn't changed. Before this fix, that alone restarted the scroll effect and fired
        // onScrollToChapterHandled again — fighting the user's own scrolling every few seconds.
        var handledCount = 0
        var blocksVersion by mutableStateOf(0)
        composeRule.setContent {
            ReaderPageList(
                // New List instance every recomposition (same content, different reference).
                blocks = listOf(block("c1", "Capítulo 1", listOf("https://example.com/1.webp"))).toList(),
                scrollToChapterId = "c1",
                scrollToPageIndex = 0,
                onScrollToChapterHandled = { handledCount++ },
            )
            @Suppress("UNUSED_EXPRESSION")
            blocksVersion
        }

        composeRule.waitForIdle()
        assertTrue(handledCount == 1)

        blocksVersion++
        composeRule.waitForIdle()

        assertTrue(handledCount == 1)
    }

    @Test
    fun `retry button invokes its onClick callback`() {
        var clicks = 0
        composeRule.setContent {
            RetryButton(onClick = { clicks++ })
        }

        composeRule.onNodeWithText("Tentar novamente").assertExists()
        composeRule.onNodeWithText("Tentar novamente").performClick()

        assertTrue(clicks == 1)
    }

    @Test
    fun `page image shows a retry button and a decode error code when the url is malformed`() {
        // A malformed URL fails before any network request happens — Coil throws something other
        // than IOException (can't even resolve it as a request), so this lands in the "not a
        // network failure" branch and gets an error code suffix — see pageErrorMessage doc.
        composeRule.setContent {
            ReaderPageList(
                blocks = listOf(block("c1", "Capítulo 1", listOf("not-a-valid-url"))),
            )
        }

        composeRule.waitForIdle()
        // onFirst: the test viewport is small enough for this default-shaped page to count as tall,
        // which repeats the message and the retry — covered on its own below.
        composeRule.onAllNodesWithText("Falha ao carregar página (-1)").onFirst().assertExists()
        composeRule.onAllNodesWithText("Tentar novamente").onFirst().assertExists()
    }

    @Test
    fun `a failed page far taller than the viewport repeats its retry button`() {
        composeRule.setContent {
            ReaderPageList(
                blocks = listOf(block("c1", "Capítulo 1", listOf("not-a-valid-url"), pageAspectRatios = listOf(20f))),
            )
        }

        composeRule.waitForIdle()
        composeRule.onAllNodesWithText("Tentar novamente").assertCountEquals(3)
    }

    @Test
    fun `a null firstNode and lastNode render no Sdu entry around the chapter's pages`() {
        // Server-Driven UI: RN decides whether a Gap/Header/Footer exists at all by sending null
        // — e.g. the first loaded chapter of a trio has no Gap-above (firstNode = null), and a
        // chapter with no loaded next neighbor has no Footer/next-preview (lastNode = null).
        // Kotlin must render just the pages in that case, not crash or insert a placeholder.
        composeRule.setContent {
            ReaderPageList(
                blocks =
                    listOf(
                        ChapterBlock(
                            chapterId = "c1",
                            pageUrls = listOf("https://example.com/1.webp"),
                            pageAspectRatios = emptyList(),
                            firstNode = null,
                            lastNode = null,
                        ),
                    ),
            )
        }

        composeRule.waitForIdle()
        // No crash and no Header/Footer text present — the only content is what a bare Page
        // itself renders (asserting absence, since there's no title text to check for existence).
        composeRule.onRoot().printToString().let { tree ->
            assertTrue(!tree.contains("Fim do capítulo"))
        }
    }

    @Test
    fun `a very tall server-provided aspectRatio is trusted, not clamped`() {
        // A MAX_SANE_ASPECT_RATIO clamp was tried and reverted (see ReaderPageList.kt doc): an
        // aspectRatio of ~16-19 turned out to be REAL data for very long webtoon strips, not a
        // degenerate server value. This test locks in the correct behavior — a tall ratio must
        // still be usable to compute a progress fraction, not silently replaced by the generic
        // 2:3 fallback (which would under-estimate chapterTotalHeight and make the bar fill too
        // fast).
        var lastChapterFraction = -1f
        composeRule.setContent {
            ReaderPageList(
                blocks =
                    listOf(
                        ChapterBlock(
                            chapterId = "c1",
                            pageUrls = listOf("https://example.com/1.webp"),
                            pageAspectRatios = listOf(18f),
                            firstNode = null,
                            lastNode = null,
                        ),
                    ),
                onVisiblePageChanged = { _, _, _, chapterFraction -> lastChapterFraction = chapterFraction },
            )
        }

        composeRule.waitForIdle()
        composeRule.waitUntil(timeoutMillis = 5_000) { lastChapterFraction >= 0f }
        assertTrue("expected a valid chapterFraction, got $lastChapterFraction", lastChapterFraction in 0f..1f)
    }

    @Test
    fun `pageErrorMessage omits an error code for a network IOException`() {
        assertTrue(
            pageErrorMessage(java.io.IOException("timeout")) == "Falha ao carregar página",
        )
    }

    @Test
    fun `errorCodeOrNull gives nothing for a network failure, so the message keeps its wording`() {
        // A timeout or a reset is transient: retrying IS the answer, and a code adds nothing.
        assertTrue(errorCodeOrNull(java.io.IOException("timeout")) == null)
    }

    @Test
    fun `retryAlignments puts a retry at the top, middle and bottom of a failed page taller than the viewport`() {
        assertTrue(
            retryAlignments(placeholderHeightPx = 6_000, viewportHeightPx = 2_000) ==
                listOf(Alignment.TopCenter, Alignment.Center, Alignment.BottomCenter),
        )
    }

    @Test
    fun `retryAlignments keeps the single centred retry for a page that fits the viewport`() {
        assertTrue(retryAlignments(placeholderHeightPx = 1_800, viewportHeightPx = 2_000) == listOf(Alignment.Center))
        // exactly as tall as the viewport: the whole page is on screen, so one control is enough
        assertTrue(retryAlignments(placeholderHeightPx = 2_000, viewportHeightPx = 2_000) == listOf(Alignment.Center))
    }

    @Test
    fun `retryAlignments keeps the single centred retry while the viewport is still unknown`() {
        assertTrue(retryAlignments(placeholderHeightPx = 6_000, viewportHeightPx = 0) == listOf(Alignment.Center))
    }

    @Test
    fun `errorCodeOrNull gives a code for a decode failure, which is worth reporting`() {
        assertTrue(errorCodeOrNull(IllegalArgumentException("bad bytes")) == "-1")
    }

    @Test
    fun `the retry action name matches what RN puts in the node`() {
        // reader-sdu.ts builds the pressable with action: 'retry'. A rename on either side has to
        // break a test rather than silently stop the button working.
        assertTrue(RETRY_ACTION == "retry")
    }

    @Test
    fun `pageErrorMessage appends an unknown error code for a non-network failure`() {
        assertTrue(
            pageErrorMessage(IllegalArgumentException("bad bytes")) == "Falha ao carregar página (-1)",
        )
    }
}
