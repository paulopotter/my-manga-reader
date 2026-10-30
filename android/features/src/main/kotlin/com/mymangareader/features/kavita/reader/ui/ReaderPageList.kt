package com.mymangareader.features.kavita.reader.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.CachePolicy
import coil.request.ImageRequest
import kotlinx.coroutines.launch
import java.io.IOException

/**
 * One chapter's worth of content in the reader list. RN owns all navigation decisions (which
 * chapters are loaded, when the trio slides forward/back) — this is a dumb rendering unit: the
 * Kotlin/Compose side never decides chapter order or triggers navigation itself, it only draws
 * whatever list of blocks it's given and reports which page is visible via
 * [ReaderPageList]'s onVisiblePageChanged callback.
 *
 * [firstNode]/[lastNode] replace what used to be separate Header/Footer/Gap concepts — Server-
 * Driven UI: RN sends the ENTIRE non-page visual (title text, colors, spacing, and whether a Gap
 * exists at all) as an [SduNode] tree, and Kotlin only interprets it generically ([SduNodeView]).
 * Kotlin never again hardcodes "what a header looks like" — see SduNode.kt doc for the rationale.
 * [firstNode] renders before this chapter's pages (typically a Gap + title), [lastNode] after
 * (typically an end-of-chapter label + next-chapter preview). Either can be null — e.g. the very
 * first chapter of a trio has no Gap-above, the last loaded chapter has no Footer/next-preview if
 * RN hasn't loaded a next neighbor. RN decides ALL of this; Kotlin just draws what's handed to it.
 */
data class ChapterBlock(
    val chapterId: String,
    val pageUrls: List<String>,
    // Height/width aspect ratio per page (aligned by index with pageUrls), from Kavita's
    // chapter-info?includeDimensions=true — lets ReaderPageList size a page's landmark before it's
    // actually decoded on-device, instead of only finding out its height via onGloballyPositioned
    // once it scrolls into view. 0 (or a short list) means "unavailable for this page" — falls
    // back to the onGloballyPositioned measurement, same as before this existed.
    val pageAspectRatios: List<Float>,
    val firstNode: SduNode?,
    val lastNode: SduNode?,
)

// internal (not private) — see flattenBlocks' testability note above.
internal sealed interface ListEntry {
    data class Sdu(
        val entryKey: String,
        val chapterId: String,
        val node: SduNode,
    ) : ListEntry

    data class Page(
        val chapterId: String,
        val pageIndexInChapter: Int,
        val url: String,
        // 0 means unavailable — see ChapterBlock.pageAspectRatios.
        val aspectRatio: Float,
    ) : ListEntry
}

// internal (not private) so tests can build a real entries list from ChapterBlocks — see
// computeChapterSwitchTarget's testability note above.
internal fun flattenBlocks(blocks: List<ChapterBlock>): List<ListEntry> =
    buildList {
        blocks.forEach { block ->
            block.firstNode?.let { add(ListEntry.Sdu(entryKey = "first:${block.chapterId}", chapterId = block.chapterId, node = it)) }
            block.pageUrls.forEachIndexed { pageIndex, url ->
                val aspectRatio = block.pageAspectRatios.getOrElse(pageIndex) { 0f }
                add(ListEntry.Page(block.chapterId, pageIndex, url, aspectRatio))
            }
            block.lastNode?.let { add(ListEntry.Sdu(entryKey = "last:${block.chapterId}", chapterId = block.chapterId, node = it)) }
        }
    }

// internal (not private) — see flattenBlocks' testability note above.
internal fun ListEntry.key(): String =
    when (this) {
        is ListEntry.Sdu -> entryKey
        is ListEntry.Page -> "page:$chapterId:$pageIndexInChapter"
    }

// Rough estimate of a non-page (Sdu) entry's height in px before it's physically measured — see
// the LaunchedEffect(entries, containerWidthPx) fallback doc for why this exists. Always
// overwritten by the real onGloballyPositioned measurement the moment it composes for real.
private const val SDU_ESTIMATED_HEIGHT_PX = 220

// REVERTED — a MAX_SANE_ASPECT_RATIO=8f clamp was tried here after on-device logs showed
// aspectRatio values of ~16-19 for several pages of one chapter, suspected to be a degenerate
// server value. Turned out those ARE real aspectRatios for that chapter (very long
// webtoon/scan strips) — the clamp rejected legitimate data, forcing the generic 2:3 fallback
// for those pages instead, which UNDER-estimated chapterTotalHeight and made the progress bar
// fill too fast instead of too slow (confirmed on-device, see conversation). The original
// "crawls then jumps" symptom needs a different root cause than a single outlier polluting the
// chapter average — not yet diagnosed. Do not reintroduce a hard aspectRatio ceiling without
// separating "genuinely tall page" from "bad server data" some other way.

private data class ScrollSnapshot(
    val firstVisibleItemIndex: Int,
    val firstVisibleItemScrollOffset: Int,
    val viewportEndOffset: Int,
    val measuredItemCount: Int,
)

/**
 * Which page's bottom edge is the furthest one to have reached the MIDDLE of the viewport —
 * i.e. the last page the user has scrolled AT LEAST past the midline, not merely the one
 * touching the top. [firstVisibleItemIndex]/[firstVisibleItemScrollOffset] anchor the walk (same
 * landmarks as [computeVisiblePageAndFraction]), but the target line is the viewport's MIDLINE
 * (`absoluteScrollOffset + viewportEndOffset / 2`), not its top.
 *
 * DEPRECATED reasoning (kept for reference, no longer the active rule): this used to target the
 * viewport's BOTTOM edge (`absoluteScrollOffset + viewportEndOffset`) instead — reasoning was
 * that opening a chapter with pages 1+2 both on screen should read as "0 pages read yet", and
 * reaching the very last page's bottom edge should read 100%. That's still true for the progress
 * BAR's own fraction math (computeChapterFraction, unaffected by this change — it derives its
 * own bottomLine straight from firstVisibleItemScrollOffset, not from this function's result).
 * But using the bottom edge as the trigger for CHAPTER SWITCHING (this function's chapterId also
 * drives useReader.advanceToNextChapter/retreatToPrevChapter in RN) meant the very first pixel of
 * a neighboring chapter's page touching the bottom edge was enough to switch chapters — reported
 * by the user as switching one page early, not matching the user-specified rule ("switch chapters
 * only once the midline itself has been crossed"). Moving the target line to the midline fixes
 * chapter-switch timing to match that rule; it also means "how many pages read" (baby step 1) now
 * counts a page once its midpoint — not just a sliver of its bottom edge — has passed, which is
 * an intentional side effect (accepted, see conversation) rather than an oversight.
 */
private fun computeBottomVisiblePageIndex(
    entries: List<ListEntry>,
    itemHeights: Map<String, Int>,
    firstVisibleItemIndex: Int,
    firstVisibleItemScrollOffset: Int,
    viewportEndOffset: Int,
): ListEntry.Page? {
    // Base relativa ao próprio firstVisibleItemIndex, nunca a nenhum item anterior — ver o
    // comentário equivalente (e mais detalhado) em computeVisiblePageAndFraction.
    var cumulativeTop = 0
    // val bottomLine = cumulativeTop + firstVisibleItemScrollOffset + viewportEndOffset // DEPRECATED: bottom edge, see doc above
    val bottomLine = cumulativeTop + firstVisibleItemScrollOffset + viewportEndOffset / 2

    // Walk forward accumulating heights until the running top edge passes the viewport's bottom
    // line — the last Page entry whose top edge is still above that line is the furthest one the
    // user has scrolled to (its bottom may be fully past the line, or it may be the one currently
    // straddling it; both count as "reached").
    var runningTop = cumulativeTop
    var lastPageSeen: ListEntry.Page? = null
    var index = firstVisibleItemIndex
    while (index < entries.size && runningTop < bottomLine) {
        val entry = entries[index]
        val height = itemHeights[entry.key()] ?: break
        if (entry is ListEntry.Page) {
            lastPageSeen = entry
        } else if (entry is ListEntry.Sdu && lastPageSeen?.chapterId == entry.chapterId) {
            // A non-page (Sdu) entry of the SAME chapter (i.e. its lastNode/Footer) reached the
            // bottom line — the chapter's last page counts as fully read even though it was an
            // Sdu entry, not a Page, that crossed the line. entry.chapterId here is purely
            // structural (set by flattenBlocks from the ChapterBlock it came from) — Kotlin never
            // needs to know this Sdu node "is" a Footer, only which chapter it closes out.
            break
        }
        runningTop += height
        index++
    }
    return lastPageSeen
}

/**
 * Directional chapter-switch trigger: splits the viewport into 4 quarters (25%/50%/75% lines)
 * and picks the switch target based on scroll DIRECTION, not a single shared midline —
 * [computeBottomVisiblePageIndex]'s old approach used one midline for both directions, but its
 * "midline" was measured relative to whichever item already touches the viewport TOP, which made
 * the two directions cross at very different real screen positions (confirmed on-device:
 * scrolling down, the switch fired late — needed the next chapter's Gap/Header almost fully past
 * the midline; scrolling up, it fired early — barely needed the previous chapter's Gap/Header to
 * touch the top). Anchoring to the first/last PAGE of the neighboring chapter (not its
 * Header/Footer/Gap, which can be null or absent) fixes both: pages always exist, and the
 * direction-specific target line makes the two directions symmetric by construction:
 *   - Scrolling DOWN: switches to the NEXT chapter once its first page's TOP edge crosses into
 *     the 25%-50% band of the viewport.
 *   - Scrolling UP: switches to the PREVIOUS chapter once its last page's BOTTOM edge crosses
 *     into the 50%-75% band of the viewport.
 * Returns null when neither condition is met (stay on the current chapter) or a landmark ahead
 * isn't measured yet (same "wait for landmarks" contract as the other compute* functions here).
 *
 * internal (not private) so it's directly unit-testable — this specific trigger logic (4 quarter
 * zones, direction-dependent) is intricate enough to warrant tests that don't depend on
 * simulating real Compose scroll gestures in Robolectric, unlike the other compute* functions in
 * this file which stay private and are only exercised indirectly through ReaderPageList.
 */
internal fun computeChapterSwitchTarget(
    entries: List<ListEntry>,
    itemHeights: Map<String, Int>,
    currentChapterId: String,
    firstVisibleItemIndex: Int,
    firstVisibleItemScrollOffset: Int,
    viewportEndOffset: Int,
    scrollingDown: Boolean,
): String? {
    // Position convention matches the rest of this file (see computeVisiblePageAndFraction's
    // doc): ZERO is the TOP of firstVisibleItemIndex, not firstVisibleItemScrollOffset itself —
    // firstVisibleItemScrollOffset is how far the viewport has scrolled INTO that item, used only
    // as the comparison LINE (via targetLine below), never as a base to offset another item's
    // position by. topOfIndex(targetIndex) returns that item's top relative to this same zero:
    // negative if targetIndex is above firstVisibleItemIndex (earlier in the list), positive if
    // below. BUG FIXED here: an earlier version seeded `top` with firstVisibleItemScrollOffset
    // (double-counting the offset — once as the base, once again via targetLine below), which
    // made a page hundreds of pixels away from crossing the 50%-75% band read as already inside
    // it on-device (reader-log-v53.txt) — a chapter switch fired mid-chapter, nowhere near either
    // boundary.
    fun topOfIndex(targetIndex: Int): Int? {
        return if (targetIndex >= firstVisibleItemIndex) {
            var top = 0
            for (index in firstVisibleItemIndex until targetIndex) {
                top += itemHeights[entries[index].key()] ?: return null
            }
            top
        } else {
            var top = 0
            for (index in targetIndex until firstVisibleItemIndex) {
                top -= itemHeights[entries[index].key()] ?: return null
            }
            top
        }
    }

    val quarterLine1 = viewportEndOffset / 4
    val quarterLine2 = viewportEndOffset / 2
    val quarterLine3 = (viewportEndOffset * 3) / 4

    if (scrollingDown) {
        val currentChapterLastPageIndex = entries.indexOfLast { it is ListEntry.Page && it.chapterId == currentChapterId }
        if (currentChapterLastPageIndex == -1) return null
        val nextChapterFirstPageIndex =
            (currentChapterLastPageIndex + 1 until entries.size)
                .firstOrNull { entries[it] is ListEntry.Page }
                ?: return null
        val nextChapterFirstPage = entries[nextChapterFirstPageIndex] as ListEntry.Page
        // targetLine below embeds firstVisibleItemScrollOffset (the only place it enters this
        // computation) — mirrors computeChapterFraction's bottomLine.
        val topRelative = topOfIndex(nextChapterFirstPageIndex) ?: return null
        val topAbsolute = topRelative - firstVisibleItemScrollOffset
        return if (topAbsolute in quarterLine1..quarterLine2) nextChapterFirstPage.chapterId else null
    } else {
        val currentChapterFirstPageIndex = entries.indexOfFirst { it is ListEntry.Page && it.chapterId == currentChapterId }
        if (currentChapterFirstPageIndex == -1) return null
        val prevChapterLastPageIndex =
            (currentChapterFirstPageIndex - 1 downTo 0)
                .firstOrNull { entries[it] is ListEntry.Page }
                ?: return null
        val prevChapterLastPage = entries[prevChapterLastPageIndex] as ListEntry.Page
        val prevChapterLastPageHeight = itemHeights[prevChapterLastPage.key()] ?: return null
        val topRelative = topOfIndex(prevChapterLastPageIndex) ?: return null
        val topAbsolute = topRelative - firstVisibleItemScrollOffset
        val bottomAbsolute = topAbsolute + prevChapterLastPageHeight
        return if (bottomAbsolute in quarterLine2..quarterLine3) prevChapterLastPage.chapterId else null
    }
}

/**
 * BABY STEP 2: continuous progress fraction across the WHOLE chapter, weighted by each page's
 * real height — not "which page" (baby step 1) and not "fraction within one page" alone. Each
 * page's share of the chapter is proportional to its own height vs. the chapter's total height
 * (a short page contributes less to the bar than a tall one), and the "read" line is the
 * viewport's BOTTOM edge (same reasoning as [computeBottomVisiblePageIndex] — the user
 * confirmed this: opening a chapter with the next page peeking in shouldn't already count it,
 * only content that's fully scrolled past the bottom of the screen).
 *
 * Returns null when the chapter's total height isn't fully known yet (an unmeasured page ahead
 * — same "wait for landmarks" contract as the other compute* functions here). Header/Footer are
 * deliberately excluded from the height sum: they exist for infinite-scroll structure, not
 * reading progress, and — unlike Pages — never get a pre-computed height from Kavita's
 * aspectRatio data (only onGloballyPositioned measures them, which for the Footer only happens
 * once the user has already scrolled to the very end of the chapter). Requiring their height
 * would make chapterFraction uncomputable — permanently null — until that first full read-through,
 * which is exactly what caused the bar to sit stuck at 0% (confirmed via reader-log-v16.txt:
 * chapterFraction=0.0 on every single line, chapter never reached its Footer).
 *
 * NOTE for future work: this same bottom-of-viewport pixel math (chapter-relative absolute
 * offset ÷ total chapter height) is a natural building block for restoring scroll to the exact
 * pixel the user left off at, not just the top of the page they were on (currently
 * scrollToItem(pageIndex) with no offset — see the `scrollToPageIndex` LaunchedEffect below).
 * Deliberately not wired up yet — this pass only touches the progress bar, per explicit
 * instruction to change one thing at a time.
 */
private fun computeChapterFraction(
    entries: List<ListEntry>,
    itemHeights: Map<String, Int>,
    chapterId: String,
    firstVisibleItemIndex: Int,
    firstVisibleItemScrollOffset: Int,
    viewportEndOffset: Int,
): Float? {
    // Only Pages ever count toward reading progress — Header/Footer/Gap are pure list-structure
    // scaffolding (infinite-scroll plumbing), never part of "how much of the chapter's content
    // has been read". An earlier version of this function used the chapter's Header as a
    // measuring stick to locate the chapter's start relative to the viewport — but the Header
    // has no image to derive a height from, so it depended on either being physically scrolled
    // past (measured via onGloballyPositioned) or a rough guessed fallback height, neither of
    // which is real reading data. That's backwards: the first PAGE already gives us everything
    // needed to place the chapter's start, using the same real/estimated Page heights that
    // chapterTotalHeight below already sums — no Header/Footer measurement ever required.
    val chapterPages = entries.filterIsInstance<ListEntry.Page>().filter { it.chapterId == chapterId }
    if (chapterPages.isEmpty()) return null

    var chapterTotalHeight = 0
    for (page in chapterPages) {
        chapterTotalHeight += itemHeights[page.key()] ?: return null
    }
    if (chapterTotalHeight <= 0) return null

    // DEBUG — per-page height/aspectRatio breakdown for this chapter, to catch a single
    // degenerate server-provided aspectRatio inflating chapterTotalHeight (and therefore making
    // the progress bar crawl artificially slowly until the real onGloballyPositioned measurement
    // overwrites the bad estimate). Gated by ReaderDebugFlags.verboseScrollLogging (off by
    // default) — see its doc.
    ReaderDebugFlags.d("CoilDiagnostic") {
        "chapterTotalHeight chapterId=$chapterId total=$chapterTotalHeight pages=" +
            chapterPages.joinToString(", ") { "p${it.pageIndexInChapter}:h=${itemHeights[it.key()]},ar=${it.aspectRatio}" }
    }

    // Tudo relativo ao topo de firstVisibleItemIndex (offset 0 ali) — nunca soma a partir de um
    // item anterior a ele. Ver o comentário mais detalhado em computeVisiblePageAndFraction:
    // mesmo dentro do MESMO capítulo, itens anteriores na lista podem nunca ter sido medidos se
    // o usuário "pousou" numa página do meio rolando de volta por trás (ex: página 8 sem nunca
    // ter passado fisicamente pelas páginas 0-7 ainda).
    val bottomLine = firstVisibleItemScrollOffset + viewportEndOffset

    // chapterId aqui é bottomPage.chapterId (o capítulo cujo fundo o usuário já alcançou), que
    // pode ser diferente do capítulo de firstVisibleItemIndex (topo da tela ainda no capítulo
    // anterior, fundo já mostrando o próximo). chapterStartTop é a posição da PRIMEIRA PÁGINA
    // deste capítulo relativa ao mesmo zero (topo de firstVisibleItemIndex) — soma só entre os
    // dois pontos mais próximos um do outro na direção certa. Header/Footer/Gap no caminho
    // contam como altura ZERO aqui (não itemHeights[...] ?: return null) — eles não fazem parte
    // do que estamos medindo (só Pages contam para "quanto foi lido", ver o comentário no topo
    // da função), então não faz sentido a função inteira falhar por causa de um item cuja altura
    // é irrelevante para o resultado. Sem isso, avançar para um capítulo ainda dependia
    // indiretamente do Header dele estar medido, mesmo com chapterTotalHeight já ignorando-o.
    val firstPageIndex = entries.indexOfFirst { it is ListEntry.Page && it.chapterId == chapterId }
    if (firstPageIndex == -1) return null
    val chapterStartTop =
        if (firstPageIndex <= firstVisibleItemIndex) {
            var top = 0
            for (index in firstPageIndex until firstVisibleItemIndex) {
                val entry = entries.getOrNull(index)
                if (entry !is ListEntry.Page) continue
                top -= itemHeights[entry.key()] ?: return null
            }
            top
        } else {
            var top = 0
            for (index in firstVisibleItemIndex until firstPageIndex) {
                val entry = entries.getOrNull(index)
                if (entry !is ListEntry.Page) continue
                top += itemHeights[entry.key()] ?: return null
            }
            top
        }
    val readWithinChapter = (bottomLine - chapterStartTop).coerceIn(0, chapterTotalHeight)

    return (readWithinChapter.toFloat() / chapterTotalHeight.toFloat()).coerceIn(0f, 1f)
}

/**
 * Landmarks-based scroll fraction: derives which page is visible and how far scrolled into it
 * the viewport is from [firstVisibleItemIndex]/[firstVisibleItemScrollOffset] (updated
 * synchronously by the scroll gesture itself) plus each entry's real measured height in
 * [itemHeights] — never from LazyListState.layoutInfo.visibleItemsInfo, which only refreshes on a
 * Compose measure pass and can fall behind a burst of quick manual swipes. Returns null when an
 * entry ahead hasn't been measured yet (nothing to compute against) or no Page/Footer is found.
 */
private fun computeVisiblePageAndFraction(
    entries: List<ListEntry>,
    itemHeights: Map<String, Int>,
    firstVisibleItemIndex: Int,
    firstVisibleItemScrollOffset: Int,
): Pair<ListEntry.Page, Float>? {
    // Nunca soma a altura de itens ANTERIORES a firstVisibleItemIndex — nem "desde o item 0",
    // nem "desde o Header do capítulo atual" (uma tentativa anterior fazia isso, e ainda
    // quebrava: ao rolar de VOLTA para dentro de um capítulo vizinho vindo de baixo — ex: pousar
    // direto na página 8 de um capítulo sem ter "passado" fisicamente pelas páginas 0-7 dele
    // ainda, porque a rolagem para cima está entrando por trás — essas páginas anteriores na
    // lista nunca tinham sido compostas/medidas, mesmo sendo do MESMO capítulo). A única coisa
    // sempre garantidamente medida é o próprio item que já está tocando o topo da tela agora —
    // então a base (cumulativeTop) é 0 relativo a ELE MESMO, nunca relativo a nada anterior.
    var cumulativeTop = 0
    val absoluteScrollOffset = firstVisibleItemScrollOffset

    // Walk forward from firstVisibleItemIndex to find the Page (or a same-chapter Sdu entry that
    // CLOSES that chapter out — i.e. its lastNode/Footer, only once at least one of its own Pages
    // has already been walked past — treated as "last page fully read") that absoluteScrollOffset
    // currently falls within. An Sdu entry that OPENS a chapter (firstNode/Header/Gap, no Page of
    // its own chapterId seen yet) is not a valid stop here — unlike the old Header/Footer split,
    // firstNode and lastNode are both plain Sdu now, so this loop tells them apart by whether a
    // Page of the same chapter already passed, not by type. Skipped just like any other
    // structural entry (Gap) barely clinging to the viewport edge by a pixel, in favor of the
    // Page actually filling the screen.
    var runningTop = cumulativeTop
    var targetIndex = firstVisibleItemIndex
    var targetEntry: ListEntry? = null
    while (targetIndex < entries.size) {
        val entry = entries[targetIndex]
        val height = itemHeights[entry.key()] ?: break
        val closesAChapter =
            entry is ListEntry.Sdu &&
                entries.take(targetIndex).any { it is ListEntry.Page && it.chapterId == entry.chapterId }
        if (entry is ListEntry.Page || closesAChapter) {
            targetEntry = entry
            break
        }
        runningTop += height
        targetIndex++
    }

    return when (val entry = targetEntry) {
        is ListEntry.Sdu -> {
            val lastPage =
                entries
                    .take(targetIndex)
                    .lastOrNull { it is ListEntry.Page && it.chapterId == entry.chapterId }
                    as? ListEntry.Page
                    ?: return null
            lastPage to 1f
        }
        is ListEntry.Page -> {
            val height = itemHeights[entry.key()]
            if (height == null || height <= 0) return entry to 0f

            // firstVisibleItemIndex/layout-based signals (canScrollForward, "is the Footer
            // visible") are NOT reliable for detecting "user scrolled past this page" on their
            // own: for a short last page (e.g. 884px, well under a ~2500px viewport) the Footer
            // can already peek into view — or firstVisibleItemIndex can get stuck one entry short
            // of ever reaching it — while the user has barely started reading that page. Both
            // reproduced identically in on-device logs (fraction=1.0 while
            // firstVisibleItemScrollOffset was still climbing steadily within the same page).
            // canScrollForward also breaks once the prev/next chapter trio is re-enabled for
            // infinite scroll: it only reflects the end of the WHOLE loaded list (curr+next), not
            // this specific chapter's Footer, so it'd stay true long after curr's page is
            // actually fully read. The only thing that generalizes to both cases is comparing
            // absoluteScrollOffset directly against this PAGE's own known start position
            // (runningTop) and height — both already known from itemHeights (server-provided
            // dimensions or a real measurement) regardless of what's currently laid out on screen.
            val fraction = ((absoluteScrollOffset - runningTop).toFloat() / height.toFloat()).coerceIn(0f, 1f)
            entry to fraction
        }
        else -> null
    }
}

/**
 * Renders one or more chapters as a continuous vertical scroll, mirroring the reference
 * project's WebtoonColumn (my-manga-app-reader) — but blocks come entirely from RN via
 * [blocks], never decided here. SubcomposeAsyncImage + Modifier.fillMaxWidth() (no fixed
 * height) lets Compose's own draw pipeline handle tall webtoon pages without the
 * GL_MAX_TEXTURE_SIZE ceiling that a single classic-View ImageView hits — no manual bitmap
 * slicing needed.
 */
@Composable
fun ReaderPageList(
    blocks: List<ChapterBlock>,
    // Which page RN wants the list scrolled to right now — set once when the reader opens (or
    // reopens a different chapterId) to jump straight to the Header of that chapter, matching
    // "continue reading" semantics. Left unset (null pageIndex) while merely scrolling forward
    // to a chapter that was already the visible next block — that natural scroll must never be
    // fought by a programmatic jump, which is why this is a one-shot request, not a continuous
    // binding: RN clears it after the native side reports the scroll happened.
    scrollToChapterId: String? = null,
    scrollToPageIndex: Int? = null,
    modifier: Modifier = Modifier,
    // pageFraction: how much of the CURRENT page (top-anchored, computeVisiblePageAndFraction —
    // the pre-existing landmarks logic) has scrolled past — the "X%" the user asked to see next
    // to the page itself. chapterFraction: the whole-chapter continuous fraction (see
    // computeChapterFraction) driving the progress bar — the "Y%" for the chapter as a whole.
    onVisiblePageChanged: (chapterId: String, pageIndex: Int, pageFraction: Float, chapterFraction: Float) -> Unit = { _, _, _, _ -> },
    onScrollToChapterHandled: () -> Unit = {},
    // Tap detected directly on the LazyColumn via pointerInput/detectTapGestures — mirrors the
    // reference project's WebtoonColumn onTap. Doing this here (not via an RN Pressable overlay)
    // is what lets Compose's own gesture recognizer stay in the same touch-arbitration tree as
    // the LazyColumn's scroll gesture, so a tap never races with (and sometimes blocks) scroll —
    // an RN-side PanResponder placed over this native view raced the Compose gesture detector for
    // the touch stream and intermittently ate scroll gestures, confirmed on-device.
    onTap: () -> Unit = {},
    // What a page draws while it loads, and when it fails. Both come from RN as SDU so the colours
    // follow the active theme and the words follow the app's language; null falls back to the
    // plain Compose UI below, which is never invisible but is neither themed nor translated.
    pageLoadingNode: SduNode? = null,
    pageErrorNode: SduNode? = null,
    // Per-page zoom (double-tap or pinch). RN owns whether it exists at all; Kotlin only draws it.
    // onZoomChanged fires when the user enters or leaves zoom, so RN can tuck its overlay away.
    zoomEnabled: Boolean = false,
    onZoomChanged: (zoomed: Boolean) -> Unit = {},
) {
    val listState = rememberLazyListState()
    val context = LocalContext.current
    val preloader = remember { PagePreloader(context) }
    val entries = remember(blocks) { flattenBlocks(blocks) }
    val allPageUrls = remember(blocks) { blocks.flatMap { it.pageUrls } }

    // Real on-screen height (px) of each item — either reported by Modifier.onGloballyPositioned
    // as it's measured, or precomputed below from ChapterBlock.pageAspectRatios (server-provided
    // dimensions) before the page has ever been decoded on-device. See the "landmarks" approach
    // below for why this replaces reading LazyListState.layoutInfo.visibleItemsInfo every frame.
    // Keyed by ListEntry.key() (stable across `entries` reference changes from RN re-renders)
    // rather than list index.
    val itemHeights = remember { mutableStateMapOf<String, Int>() }
    var containerWidthPx by remember { mutableIntStateOf(0) }
    var containerHeightPx by remember { mutableIntStateOf(0) }

    // Precomputes Page landmarks from server-provided aspect ratios as soon as both the entry
    // list and the container's real width are known — this is what lets scrollFraction be
    // accurate for a page the user hasn't scrolled to yet at all, not just pages that already
    // passed through onGloballyPositioned. Only fills in entries not already measured for real
    // (onGloballyPositioned's actual decoded size always wins over this estimate — see the put
    // guard below) and only overwrites its own prior estimate, never a real measurement.
    //
    // Kavita's dimension endpoint is best-effort — some pages in a chapter can legitimately come
    // back without a known aspect ratio (entry.aspectRatio <= 0f). Leaving those entirely
    // unestimated meant chapterTotalHeight in computeChapterFraction (which requires EVERY page
    // of a chapter to have a known height) could never be computed until the user had physically
    // scrolled past every single page at least once — permanently stuck for a chapter entered
    // from the middle/end (e.g. scrolling backward into a chapter's last pages). Falls back to
    // the AVERAGE aspect ratio of this same chapter's pages that DO have server data, since pages
    // within one manga/webtoon chapter tend to share similar proportions; if the whole chapter has
    // no server data at all, falls back to a generic 2:3 portrait ratio as a last resort.
    //
    // A MAX_SANE_ASPECT_RATIO clamp was tried and reverted here — see the doc at its old
    // declaration site for why (aspectRatio values of ~16-19 turned out to be REAL data for very
    // long webtoon strips, not a degenerate server value; clamping them under-estimated
    // chapterTotalHeight and made the bar fill too fast instead of too slow).
    LaunchedEffect(entries, containerWidthPx) {
        if (containerWidthPx <= 0) return@LaunchedEffect
        val averageAspectRatioByChapter =
            entries
                .filterIsInstance<ListEntry.Page>()
                .filter { it.aspectRatio > 0f }
                .groupBy { it.chapterId }
                .mapValues { (_, pages) -> pages.map { it.aspectRatio }.average().toFloat() }
        ReaderDebugFlags.d("CoilDiagnostic") { "fallback averageAspectRatioByChapter=$averageAspectRatioByChapter" }
        var filled = 0
        entries.forEach { entry ->
            val key = entry.key()
            if (key in itemHeights) return@forEach
            when (entry) {
                is ListEntry.Page -> {
                    val aspectRatio =
                        entry.aspectRatio.takeIf { it > 0f }
                            ?: averageAspectRatioByChapter[entry.chapterId]
                            ?: (2f / 3f)
                    itemHeights[key] = (containerWidthPx * aspectRatio).toInt()
                    filled++
                }
                // Sdu entries (firstNode/lastNode — what used to be Header/Footer/Gap) have no
                // image to derive an aspect ratio from — they're never covered by the Page
                // fallback above, and never had ANY estimate path before onGloballyPositioned
                // physically measured them. That meant computeChapterFraction's chapterStartTop
                // walk could permanently fail for a chapter entered from the END (scrolling
                // backward) — a firstNode, being the FIRST entry of that chapter, is the very last
                // thing such a user would ever physically scroll past. SDU_ESTIMATED_HEIGHT_PX is
                // a rough placeholder — always overwritten the moment the real node composes.
                is ListEntry.Sdu -> {
                    itemHeights[key] = SDU_ESTIMATED_HEIGHT_PX
                    filled++
                }
            }
        }
        ReaderDebugFlags.d("CoilDiagnostic") { "fallback filled=$filled entriesCount=${entries.size} itemHeightsSize=${itemHeights.size}" }
    }

    DisposableEffect(Unit) {
        onDispose { preloader.clear() }
    }

    // Deliberately NOT keyed on `entries`: RN re-renders (and hands down a new `blocks`
    // reference) constantly as neighbor chapters finish prefetching, which would otherwise
    // restart this effect and re-fire the scroll every time — fighting the user's own natural
    // scrolling every few seconds. Only a genuinely new scroll request (different chapterId or
    // pageIndex) should trigger a jump; `entries` is read fresh inside the effect body via a
    // rememberUpdatedState-style capture so it still targets the current list.
    val latestEntries by rememberUpdatedState(entries)
    val latestAllPageUrls by rememberUpdatedState(allPageUrls)
    LaunchedEffect(scrollToChapterId, scrollToPageIndex) {
        if (scrollToChapterId == null) return@LaunchedEffect
        val targetIndex =
            latestEntries.indexOfFirst {
                it is ListEntry.Page && it.chapterId == scrollToChapterId && it.pageIndexInChapter == (scrollToPageIndex ?: 0)
            }
        if (targetIndex >= 0) {
            listState.scrollToItem(targetIndex)
        }
        onScrollToChapterHandled()
    }

    // Landmarks approach: instead of asking "what fraction of the currently-visible item's
    // height has scrolled past" every frame (which needs LazyListState.layoutInfo —
    // visibleItemsInfo's offset/size — recomputed on every measure pass), precompute each item's
    // cumulative top-edge position (sum of every prior item's real measured height) once its
    // height is known via itemHeights, then derive scrollFraction from
    // firstVisibleItemScrollOffset (a plain Int, no measure-pass dependency) against that
    // landmark. This was the actual fix for the progress bar "not tracking scroll": reading
    // layoutInfo/visibleItemsInfo was correct in principle, but a burst of quick manual swipes
    // (confirmed via ViewPostIme pointer down/up events in logcat, ~250-700ms apart) meant the
    // Compose measure pass — needed to refresh layoutInfo — didn't keep up frame-by-frame with
    // each swipe, so most of the swipes' scroll distance was invisible to the observer and only
    // showed up as one big jump once measurement caught up. firstVisibleItemScrollOffset is
    // updated synchronously by the scroll gesture itself (LazyListState's own scroll consumption),
    // not by a subsequent measure pass, so it can't fall behind swipes the same way.
    LaunchedEffect(listState) {
        // Debug-only: cumulative absolute scroll position from the previous emission, so each log
        // line can show the raw pixel delta the finger/fling actually moved between emissions —
        // makes it possible to compare "pixels moved" directly against "fraction reported" instead
        // of inferring it from timestamps.
        var lastAbsoluteScrollOffset: Int? = null

        // DEPRECATED (kept for reference, no longer read): single shared "last good fraction"
        // across ALL chapters. This was the root cause of a real bug — while crossing from
        // chapter 40 back into 39, bottomPage's own fallback (see lastKnownBottomPage below) had
        // already switched sources independently of this variable, so a tick could report
        // chapterId=39 (from one fallback) alongside a chapterFraction still holding chapter 40's
        // last value (from this shared variable) — two numbers from two different chapters
        // stitched into one payload. Replaced by lastChapterFractionByChapterId below, keyed per
        // chapterId, so a fallback value can never leak from one chapter into another's report.
        var lastChapterFraction = 0f

        // Per-chapterId "last good chapterFraction" — see the DEPRECATED note above for why a
        // single shared value was wrong. When computeChapterFraction can't compute a fresh value
        // for the CURRENT bottomPage.chapterId this tick, we fall back to this chapter's own last
        // known value (or 0f if it's never had one) — never another chapter's.
        val lastChapterFractionByChapterId = HashMap<String, Float>()

        // Per-tick "last good position" for bottomPage (chapterId+pageIndexInChapter as one
        // atomic unit) — see the DEPRECATED note on the old `?: visibleEntry` fallback further
        // down. computeBottomVisiblePageIndex failing on a given tick no longer means silently
        // switching to a DIFFERENT calculation (visibleEntry, top-anchored) that can legitimately
        // point at a different chapter during a trio-slide transition — it now just repeats the
        // last successful bottomPage result, which is always internally consistent (chapterId and
        // pageIndexInChapter always came from the same computeBottomVisiblePageIndex call).
        var lastKnownBottomPage: ListEntry.Page? = null

        // The chapterId last REPORTED to RN (via onVisiblePageChanged) — the anchor
        // computeChapterSwitchTarget checks the neighbors of, and what's reported again whenever
        // the directional trigger doesn't fire this tick (i.e. still inside the current chapter's
        // "home" zone, not crossing into a neighbor's 25%-50%/50%-75% band). Seeded from the first
        // successful bottomPage so it always starts as a real chapterId, never null.
        var lastReportedChapterId: String? = null

        // Reading itemHeights.size inside the snapshotFlow block (not just inside collect) makes
        // this flow re-emit whenever a new item finishes measuring too — not only on scroll.
        // Needed because onGloballyPositioned for the initially-visible items and this flow's
        // first emission race each other with no guaranteed order; without this, a first emission
        // that lands before the visible item is measured would return null from
        // computeVisiblePageAndFraction and, with no further scroll to trigger a re-emission
        // (e.g. right after opening the reader, or in a Robolectric test with no real gesture),
        // never recover.
        snapshotFlow {
            // itemHeights.size is included purely to make this flow re-emit when a new item
            // finishes measuring (see comment above) — its value is otherwise unused.
            ScrollSnapshot(
                firstVisibleItemIndex = listState.firstVisibleItemIndex,
                firstVisibleItemScrollOffset = listState.firstVisibleItemScrollOffset,
                viewportEndOffset = listState.layoutInfo.viewportEndOffset,
                measuredItemCount = itemHeights.size,
            )
        }.collect { snapshot ->
            ReaderDebugFlags.d("CoilDiagnostic") {
                "collect tick firstVisibleIndex=${snapshot.firstVisibleItemIndex} offset=${snapshot.firstVisibleItemScrollOffset}"
            }
            val result =
                computeVisiblePageAndFraction(
                    entries = latestEntries,
                    itemHeights = itemHeights,
                    firstVisibleItemIndex = snapshot.firstVisibleItemIndex,
                    firstVisibleItemScrollOffset = snapshot.firstVisibleItemScrollOffset,
                ) ?: return@collect
            val (visibleEntry, scrollFraction) = result
            val firstVisibleItemIndex = snapshot.firstVisibleItemIndex
            val firstVisibleItemScrollOffset = snapshot.firstVisibleItemScrollOffset

            var cumulativeTop = 0
            for (index in 0 until firstVisibleItemIndex) {
                cumulativeTop += itemHeights[latestEntries.getOrNull(index)?.key()] ?: 0
            }
            val absoluteScrollOffset = cumulativeTop + firstVisibleItemScrollOffset
            val deltaPx = lastAbsoluteScrollOffset?.let { absoluteScrollOffset - it }
            lastAbsoluteScrollOffset = absoluteScrollOffset

            // BABY STEP 1: RN's progress bar only cares about "which page index to report",
            // computed from the viewport's BOTTOM edge — not top-anchored visibleEntry above,
            // which stays reserved for scrollFraction/CoilDiagnostic logging (untouched Kotlin
            // landmarks logic, kept alive but unused by the bar per explicit instruction).
            //
            // DEPRECATED fallback removed: `?: visibleEntry` used to substitute a DIFFERENT
            // calculation (top-anchored, can legitimately point at a different chapter during
            // a trio-slide transition) whenever this bottom-anchored one failed for a tick.
            // Real bug traced to exactly this: mid-transition, bottomPage.chapterId could
            // come from visibleEntry (chapter 40) while pageIndexInChapter still read like
            // chapter 39's last page — two numbers from two different sources stitched into
            // one payload no consumer could trust. Falling back to lastKnownBottomPage instead
            // repeats the last internally-consistent result (chapterId + pageIndexInChapter
            // always from the same computeBottomVisiblePageIndex call) rather than switching
            // to a different, possibly-disagreeing source.
            val computedBottomPage =
                computeBottomVisiblePageIndex(
                    entries = latestEntries,
                    itemHeights = itemHeights,
                    firstVisibleItemIndex = firstVisibleItemIndex,
                    firstVisibleItemScrollOffset = firstVisibleItemScrollOffset,
                    viewportEndOffset = snapshot.viewportEndOffset,
                )
            val bottomPage = computedBottomPage ?: lastKnownBottomPage ?: visibleEntry
            lastKnownBottomPage = bottomPage

            // Directional chapter-switch trigger — see computeChapterSwitchTarget doc. Anchors
            // on lastReportedChapterId (the chapter RN currently thinks it's in), not
            // bottomPage.chapterId directly: bottomPage already looks ahead into a neighbor
            // chapter once its pages start entering the viewport, which would make this
            // trigger check the WRONG pair of neighbors (e.g. next-of-next instead of
            // next-of-current) right as a switch is in flight. deltaPx == null (first tick,
            // no prior offset yet) defaults to "not scrolling down" — the trigger simply
            // won't fire that tick, which is fine since nothing has moved yet anyway.
            val anchorChapterId = lastReportedChapterId ?: bottomPage.chapterId
            val switchTarget =
                computeChapterSwitchTarget(
                    entries = latestEntries,
                    itemHeights = itemHeights,
                    currentChapterId = anchorChapterId,
                    firstVisibleItemIndex = firstVisibleItemIndex,
                    firstVisibleItemScrollOffset = firstVisibleItemScrollOffset,
                    viewportEndOffset = snapshot.viewportEndOffset,
                    scrollingDown = (deltaPx ?: 0) > 0,
                )
            val reportedChapterId = switchTarget ?: anchorChapterId
            lastReportedChapterId = reportedChapterId

            // pageIndex reported alongside reportedChapterId must always be FROM that same
            // chapter — never bottomPage.pageIndexInChapter directly, which can still belong
            // to the OLD chapter for a tick or two right as switchTarget fires (bottomPage's
            // own "which page is furthest read" walk lags behind the directional trigger by
            // design — they're independent signals). When switchTarget just fired, 0 (just
            // arrived at the top, scrolling down) or the target chapter's last page index
            // (just arrived at the bottom, scrolling up) is the correct "position" to report;
            // otherwise bottomPage already agrees with reportedChapterId, so its own
            // pageIndexInChapter is correct as-is.
            val reportedPageIndex =
                if (bottomPage.chapterId == reportedChapterId) {
                    bottomPage.pageIndexInChapter
                } else if (switchTarget != null && (deltaPx ?: 0) > 0) {
                    0
                } else {
                    latestEntries
                        .filterIsInstance<ListEntry.Page>()
                        .lastOrNull { it.chapterId == reportedChapterId }
                        ?.pageIndexInChapter
                        ?: 0
                }

            // BABY STEP 2: continuous chapter-wide fraction (page-height-weighted), replacing
            // baby step 1's coarse (pageIndex+1)/totalPages — see computeChapterFraction doc.
            // Uses reportedChapterId (not bottomPage.chapterId) so the payload is always
            // internally consistent — chapterId/pageIndex/chapterFraction must all describe
            // the SAME chapter, or RN's advanceToNextChapter/retreatToPrevChapter (which
            // trusts this payload as one atomic unit) can desync (the exact bug
            // lastChapterFractionByChapterId below was introduced to fix — see its doc).
            // Falls back to THIS CHAPTER's own last known good fraction (never another
            // chapter's) while an entry ahead isn't measured yet (same "wait for landmarks"
            // contract every compute* function here follows).
            val chapterFraction =
                computeChapterFraction(
                    entries = latestEntries,
                    itemHeights = itemHeights,
                    chapterId = reportedChapterId,
                    firstVisibleItemIndex = firstVisibleItemIndex,
                    firstVisibleItemScrollOffset = firstVisibleItemScrollOffset,
                    viewportEndOffset = snapshot.viewportEndOffset,
                )?.also { lastChapterFractionByChapterId[reportedChapterId] = it }
                    ?: lastChapterFractionByChapterId[reportedChapterId]
                    ?: 0f

            ReaderDebugFlags.d("CoilDiagnostic") {
                "scrollFraction chapterId=${visibleEntry.chapterId} page=${visibleEntry.pageIndexInChapter} " +
                    "bottomPage=${bottomPage.pageIndexInChapter} chapterFraction=$chapterFraction " +
                    "screenPercent=${Math.round(scrollFraction * 100)}% " +
                    "firstVisibleIndex=$firstVisibleItemIndex firstVisibleOffset=$firstVisibleItemScrollOffset " +
                    "viewportEndOffset=${snapshot.viewportEndOffset} " +
                    "itemHeight=${itemHeights[visibleEntry.key()]} " +
                    "absoluteScrollOffset=$absoluteScrollOffset deltaPx=$deltaPx fraction=$scrollFraction " +
                    "switchTarget=$switchTarget reportedChapterId=$reportedChapterId reportedPageIndex=$reportedPageIndex"
            }

            onVisiblePageChanged(reportedChapterId, reportedPageIndex, scrollFraction, chapterFraction)

            val absoluteIndex = latestAllPageUrls.indexOf(visibleEntry.url)
            if (absoluteIndex >= 0) {
                preloader.updateWindow(computePreloadWindow(allPageUrls, absoluteIndex))
            }
        }
    }

    // --- Per-page zoom. See PageZoom.kt for the model: one page, drawn alone over the list, the
    // list's scroll locked until the user leaves zoom. ---
    val scope = rememberCoroutineScope()
    var zoom by remember { mutableStateOf<PageZoom?>(null) }

    fun beginZoom(
        focal: Offset,
        factor: Float,
    ): Boolean {
        val visible = listState.layoutInfo.visibleItemsInfo.map { ZoomItem(it.key.toString(), it.offset, it.size) }
        val started = startPageZoom(visible, containerWidthPx, containerHeightPx, focal.x, focal.y, factor)
        // Unconditional on purpose (a few lines per gesture, never per frame): zoom is a gesture feature
        // that can only be diagnosed on the device.
        android.util.Log.i(
            ZOOM_LOG_TAG,
            "beginZoom focal=${focal.x.toInt()},${focal.y.toInt()} factor=$factor viewport=${containerWidthPx}x$containerHeightPx " +
                "visible=${visible.joinToString { "${it.entryKey}@${it.topPx}+${it.heightPx}" }} -> ${started?.entryKey ?: "none"}",
        )
        zoom = started ?: return false
        return true
    }

    // Hands the list back where the pan ended; the layer only goes away after the list has moved, so
    // the page never flashes at its old position in between.
    fun endZoom() {
        val leaving = zoom ?: return
        val target = zoomExitTarget(leaving, latestEntries.map { it.key() })
        android.util.Log.i(ZOOM_LOG_TAG, "endZoom scale=${leaving.scale} target=$target")
        scope.launch {
            if (target != null) listState.scrollToItem(target.first, target.second)
            zoom = null
        }
    }

    // A zoomed page that is no longer in the list (chapter window slid) or a switch-off from RN ends zoom.
    LaunchedEffect(entries, zoomEnabled) {
        val current = zoom ?: return@LaunchedEffect
        if (shouldDropZoom(current, zoomEnabled, entries.map { it.key() })) zoom = null
    }

    LaunchedEffect(zoomEnabled) { android.util.Log.i(ZOOM_LOG_TAG, "zoomEnabled=$zoomEnabled") }

    val isZoomed = zoom != null
    var reportedZoomed by remember { mutableStateOf(false) }
    LaunchedEffect(isZoomed) {
        if (isZoomed != reportedZoomed) {
            reportedZoomed = isZoomed
            onZoomChanged(isZoomed)
        }
    }

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .onGloballyPositioned { coordinates ->
                    containerWidthPx = coordinates.size.width
                    containerHeightPx = coordinates.size.height
                }.pointerInput(zoomEnabled) {
                    // A double-tap handler delays onTap by the double-tap window, so it is only
                    // installed when zoom exists — with zoom off a tap stays instant.
                    detectTapGestures(
                        onTap = { onTap() },
                        onDoubleTap =
                            if (zoomEnabled) {
                                { offset ->
                                    android.util.Log.i(ZOOM_LOG_TAG, "doubleTap at=${offset.x.toInt()},${offset.y.toInt()} zoomed=${zoom != null}")
                                    if (zoom != null) endZoom() else beginZoom(offset, ZOOM_DOUBLE_TAP_SCALE)
                                }
                            } else {
                                null
                            },
                    )
                }.pointerInput(zoomEnabled) {
                    if (!zoomEnabled) return@pointerInput
                    // Not keyed on `zoom`: a pinch that starts zoom must survive the state change it
                    // causes, so the detector reads `zoom` live instead of being restarted by it.
                    detectPageZoomGestures(
                        allowSingleFinger = { zoom != null },
                        onStart = { centroid ->
                            android.util.Log.i(ZOOM_LOG_TAG, "gesture qualifies at=${centroid.x.toInt()},${centroid.y.toInt()} zoomed=${zoom != null}")
                            zoom != null || beginZoom(centroid, 1f)
                        },
                        onTransform = { centroid, pan, factor ->
                            zoom = zoom?.transformed(factor, centroid.x, centroid.y, pan.x, pan.y)
                        },
                        onEnd = { if (zoom?.isBackToNormal() == true) endZoom() },
                    )
                },
    ) {
        LazyColumn(
            state = listState,
            userScrollEnabled = zoom == null,
            modifier = Modifier.fillMaxSize(),
        ) {
            entries.forEach { entry ->
                item(key = entry.key()) {
                    val entryKey = entry.key()
                    Box(
                        modifier =
                            Modifier.onGloballyPositioned { coordinates ->
                                val newHeight = coordinates.size.height
                                val oldHeight = itemHeights[entryKey]
                                if (oldHeight != null && oldHeight != newHeight) {
                                    ReaderDebugFlags.w("CoilDiagnostic") {
                                        "itemHeights CHANGED key=$entryKey oldHeight=$oldHeight newHeight=$newHeight"
                                    }
                                }
                                itemHeights[entryKey] = newHeight
                            },
                    ) {
                        when (entry) {
                            is ListEntry.Sdu -> SduNodeView(entry.node)
                            is ListEntry.Page ->
                                ReaderPageImage(
                                    url = entry.url,
                                    aspectRatio = entry.aspectRatio,
                                    loadingNode = pageLoadingNode,
                                    errorNode = pageErrorNode,
                                    viewportHeightPx = containerHeightPx,
                                )
                        }
                    }
                }
            }
        }

        zoom?.let { current ->
            val page = entries.firstOrNull { it.key() == current.entryKey } as? ListEntry.Page
            if (page != null) {
                ZoomedPageLayer(zoom = current) {
                    ReaderPageImage(
                        url = page.url,
                        aspectRatio = page.aspectRatio,
                        loadingNode = pageLoadingNode,
                        errorNode = pageErrorNode,
                    )
                }
            }
        }
    }
}

@Composable
internal fun ReaderPageImage(
    url: String,
    aspectRatio: Float = 0f,
    loadingNode: SduNode? = null,
    errorNode: SduNode? = null,
    // The list's own height: a failed page taller than this repeats its retry control (see
    // [retryAlignments]). 0 (unknown, or a page shown on its own) keeps the single centred one.
    viewportHeightPx: Int = 0,
) {
    // Bumped by the retry button below. Included as a request parameter so Coil treats each
    // retry as a distinct cache key — otherwise a request that failed (e.g. a transient WebP
    // decode glitch) would just resolve the same failed entry from its error cache instead of
    // actually re-fetching/re-decoding the bytes.
    var retryCount by remember(url) { mutableIntStateOf(0) }

    SubcomposeAsyncImage(
        model =
            ImageRequest
                .Builder(LocalContext.current)
                .data(url)
                .setParameter("retryCount", retryCount)
                // Explicit, stable key (defaults to null otherwise) so SafeBitmapDecoder can
                // serialize this request against PagePreloader's request for the same URL — see
                // PageDecodeCoordinator for why that matters. Host- and apiKey-free, so the same
                // page is one cache entry whether it came through the LAN or the public address.
                .stableImageKeys(url)
                .apply {
                    if (retryCount > 0) {
                        memoryCachePolicy(CachePolicy.WRITE_ONLY)
                        diskCachePolicy(CachePolicy.WRITE_ONLY)
                    }
                }.build(),
        contentDescription = null,
        // Coil's default ContentScale.Fit keeps the image's own aspect ratio centered inside
        // the available width, which visually reads as black side bars whenever the decoded
        // image's aspect ratio doesn't exactly match the Box it's laid out in. FillWidth scales
        // the image to the full available width instead, matching the reference project.
        contentScale = ContentScale.FillWidth,
        modifier = Modifier.fillMaxWidth(),
    ) {
        when (painter.state) {
            is AsyncImagePainter.State.Loading, is AsyncImagePainter.State.Empty ->
                ReaderPagePlaceholder(aspectRatio) {
                    if (loadingNode != null) {
                        SduNodeView(loadingNode)
                    } else {
                        CircularProgressIndicator(color = Color.White)
                    }
                }
            is AsyncImagePainter.State.Error -> {
                val error = painter.state as AsyncImagePainter.State.Error
                ReaderPagePlaceholder(aspectRatio, viewportHeightPx = viewportHeightPx, repeatWhenTall = true) {
                    if (errorNode != null) {
                        // A network failure carries no code — the message keeps its plain wording,
                        // and any {code} the node declares is left for the decode case below.
                        SduNodeView(
                            node = errorNode,
                            substitution = errorCodeOrNull(error.result.throwable),
                            onAction = { action -> if (action == RETRY_ACTION) retryCount++ },
                        )
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(pageErrorMessage(error.result.throwable), color = Color.White)
                            RetryButton(onClick = { retryCount++ })
                        }
                    }
                }
            }
            is AsyncImagePainter.State.Success -> SubcomposeAsyncImageContent()
        }
    }
}

// Error code appended to the retry message for a NON-network failure (decode error) — lets the
// user report a specific code (e.g. in a bug report) instead of just "failed to load". -1 means
// "unknown decode failure" — real codes (corrupted file, unsupported format, etc.) are deliberately
// not assigned yet; add them here as they're identified, without changing callers.
private fun decodeErrorCode(throwable: Throwable): Int = -1

/** The action name RN gives the retry control inside `pageErrorNode` — see reader-sdu.ts. */
internal const val RETRY_ACTION = "retry"

// Only a non-network failure has a code worth showing; a timeout or a reset is transient and
// retrying is the whole answer. Null means "leave the message as it is".
internal fun errorCodeOrNull(throwable: Throwable): String? = if (throwable is IOException) null else decodeErrorCode(throwable).toString()

// A network/IO failure (timeout, connection reset, DNS, HTTP error) never gets a decode error
// code — those are transient and retrying without any extra data is enough. Only a failure that
// ISN'T network-related (e.g. Coil/SafeBitmapDecoder rejecting corrupted or unsupported image
// bytes it already fully downloaded) gets a "(n)" suffix, since those are worth being able to
// identify precisely if the user reports one.
internal fun pageErrorMessage(throwable: Throwable): String {
    if (throwable is IOException) return "Falha ao carregar página"
    return "Falha ao carregar página (${decodeErrorCode(throwable)})"
}

@Composable
internal fun RetryButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .padding(top = 16.dp)
                .background(Color.White, RoundedCornerShape(8.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 20.dp, vertical = 10.dp),
    ) {
        Text("Tentar novamente", color = Color.Black, fontWeight = FontWeight.SemiBold)
    }
}

// aspectRatio (height/width) mirrors ListEntry.Page.aspectRatio: uses the real server-provided
// ratio when known, so the placeholder's own height matches what itemHeights already estimated
// via LaunchedEffect(entries, containerWidthPx) above — otherwise the placeholder's height
// (previously a hardcoded 2:3) would win the item(key=...) measurement while loading and
// overwrite that estimate with a wrong value, then get overwritten again once the real image
// decodes. That oscillation (visible in on-device logs as itemHeights swinging between two very
// different heights for the same page) was throwing off computeChapterFraction's chapter-total
// height, making the progress bar hit 100% before the last page had actually finished scrolling
// past — since Coil's default placeholder aspect ratio (2:3) has no relation to the actual page.
/**
 * Where a failed page puts its message + retry. A webtoon page can be several screens tall, and a
 * single control in its middle means scrolling through a black stretch to find it — so a page taller
 * than the viewport carries one at the top, the middle and the bottom, and whichever part of the page
 * is on screen has one. A page that fits the viewport keeps the one in the middle.
 */
internal fun retryAlignments(
    placeholderHeightPx: Int,
    viewportHeightPx: Int,
): List<Alignment> =
    if (viewportHeightPx > 0 && placeholderHeightPx > viewportHeightPx) {
        listOf(Alignment.TopCenter, Alignment.Center, Alignment.BottomCenter)
    } else {
        listOf(Alignment.Center)
    }

@Composable
private fun ReaderPagePlaceholder(
    aspectRatio: Float = 0f,
    viewportHeightPx: Int = 0,
    repeatWhenTall: Boolean = false,
    content: @Composable () -> Unit,
) {
    BoxWithConstraints(
        modifier = Modifier.fillMaxWidth().aspectRatio(if (aspectRatio > 0f) 1f / aspectRatio else 2f / 3f),
        contentAlignment = Alignment.Center,
    ) {
        val alignments =
            if (repeatWhenTall) retryAlignments(constraints.maxHeight, viewportHeightPx) else listOf(Alignment.Center)
        alignments.forEach { alignment ->
            // The edge ones keep clear of the page's own edge, so they don't sit against the chapter band.
            Box(modifier = Modifier.align(alignment).padding(vertical = 32.dp)) { content() }
        }
    }
}
