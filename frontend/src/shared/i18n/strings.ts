export type Language = 'pt-BR' | 'en';

export interface Strings {
  // ── Common (shared across screens) ──────────────────────────────────────
  commonBackLabel: string;
  commonCloseLabel: string;
  commonMoreOptionsLabel: string;
  commonScrollToTopLabel: string;

  // ── Config screen ────────────────────────────────────────────────────────
  configTitle: string;
  configLoadError: string;
  configKavitaServers: string;
  configAddServer: string;
  configAuth: string;
  configApiKeySet: string;
  configNoApiKey: string;
  configPreferences: string;
  configKeepScreenOn: string;
  configImmersiveMode: string;
  configLanguage: string;
  configLanguagePtBr: string;
  configLanguageEn: string;
  configMenuServer: string;
  configMenuReading: string;
  configMenuSerials: string;
  configMenuNotifications: string;
  configMenuTheme: string;
  configMenuStartScreen: string;
  configMenuAdult: string;
  adultReveal: string;
  adultRevealHint: string;
  adultOnlyButton: string;
  adultOnlyButtonOff: string;
  adultOnlyHint: string;
  adultCategoriesSelected: string;
  adultCategoriesAvailable: string;
  adultCategoriesNoneSelected: string;
  adultCategoriesRemove: string; // "{0}" = category name
  adultUnblur: string;
  adultCategories: string;
  adultCategoriesHint: string;
  adultCategoriesEmpty: string;
  adultCategoriesError: string;
  configStartScreenHome: string;
  configStartScreenFollowing: string;
  themeNameTeal: string;
  themeNameCrimson: string;
  themeNameOnyx: string;
  themeNameAmber: string;
  themeNameSepia: string;
  themeNameSteel: string;
  themeNameWine: string;
  themeNameForest: string;
  // A variant that drops the identity's floor to real black, for OLED panels. Composed with the
  // name — "Petróleo - OLED" — so the pair reads as one identity with two floors.
  themeOledSuffix: string;
  // Marks whichever identity currently holds the default role — see themes/index.ts. No theme is
  // named "default", so the suffix travels with the label instead of with the name.
  themeDefaultSuffix: string;
  // Which server answers each piece of a series' metadata. Named by role, never by provider: the
  // app has a content server (serves the pages) and an enrichment server (adds metadata).
  configMetadataSourceGroupTitle: string;
  configMetadataSourceRowLabel: string;
  configMetadataSourceEnrichment: string;
  configMetadataSourceContent: string;
  // Short forms, for the two-sided toggle where the full names would not fit.
  configMetadataSourceEnrichmentShort: string;
  configMetadataSourceContentShort: string;
  configMetadataSourceFieldsTitle: string;
  configMetadataSourceFieldsHint: string;
  configMetadataSourceInherit: string;
  configMetadataFieldSummary: string;
  configMetadataFieldGenres: string;
  configMetadataFieldAuthor: string;
  configMetadataFieldStatus: string;
  configMetadataFieldAlternativeTitles: string;
  configChapterSortGroupTitle: string;

  // ── Server form ─────────────────────────────────────────────────────────
  serverFormUrlLabel: string;
  serverFormUrlPlaceholder: string;
  serverFormTimeoutLabel: string;
  serverFormPriorityLabel: string;
  serverFormHealthCheckLabel: string;
  serverFormCancel: string;
  serverFormSave: string;

  // ── Server list ─────────────────────────────────────────────────────────
  serverListEmpty: string;
  serverListPriority: string;
  serverListEdit: string;
  serverListDelete: string;

  // ── API Key form ─────────────────────────────────────────────────────────
  apiKeyChange: string;
  apiKeyPlaceholder: string;
  apiKeyCancel: string;
  apiKeySave: string;

  // ── BFF config ──────────────────────────────────────────────────────────
  bffServers: string;
  bffAddServer: string;
  bffUrlLabel: string;
  bffUrlPlaceholder: string;
  bffLinkKavitaLabel: string;
  bffLinkKavitaNone: string;
  bffPathLabel: string;
  bffPathPlaceholder: string;
  bffAdd: string;
  bffRemove: string;
  bffLinkedTo: string;

  // ── Library screen ───────────────────────────────────────────────────────
  libraryTitle: string;
  libraryLoading: string;
  libraryEmpty: string;
  libraryError: string;
  libraryRetry: string;
  librarySortRecentlyUpdated: string;
  librarySortAlphabetical: string;
  libraryViewGrid: string;
  libraryViewList: string;
  librarySeriesCount: string;
  libraryFilterButtonLabel: string;
  libraryFilterMenuTitle: string;
  libraryFilterClearAll: string;
  libraryFilterNoResults: string;

  // ── Following screen ─────────────────────────────────────────────────────
  followingEmpty: string;

  // ── Series card ──────────────────────────────────────────────────────────
  readStatusUnread: string;
  readStatusReading: string;
  readStatusRead: string;
  publicationOngoing: string;
  publicationCompleted: string;
  publicationCancelled: string;
  publicationOnHiatus: string;
  publicationAbandoned: string;
  chaptersFormat: string;
  hasErrors: string;

  // ── Bottom bar ───────────────────────────────────────────────────────────
  bottomBarLibrary: string;
  bottomBarSettings: string;

  // ── Bottom nav (react-navigation tabs) ───────────────────────────────────
  navLibrary: string;
  navDashboard: string;
  navFollowing: string;
  navSearch: string;
  navNotifications: string;
  navConfig: string;

  // ── Dashboard (Home tab) ─────────────────────────────────────────────────
  dashboardContinueReading: string;
  dashboardFollowedUpdated: string;
  dashboardRecentlyUpdated: string;
  dashboardUnfinished: string;
  dashboardRecentlyAdded: string;
  dashboardChapter: string; // "{0}" = chapter number — "Cap. {0}"
  dashboardPercentRead: string; // "{0}" = percent — "{0}% lido"
  dashboardNextChapter: string; // "{0}" = chapter number — "Próximo: Cap. {0}"
  serieBadgeNovel: string;
  serieBadgePdf: string;
  dashboardStatSeries: string;
  dashboardStatFollowed: string;
  dashboardStatInProgress: string;
  dashboardError: string;
  dashboardRetry: string;
  bookReaderLoading: string;
  bookReaderError: string;
  bookReaderRetry: string;
  bookReaderFontSmaller: string;
  bookReaderFontLarger: string;
  bookReaderPrevPage: string;
  bookReaderNextPage: string;
  bookReaderPage: string; // "{0}" = current page, "{1}" = total — "Página {0} de {1}"
  bookReaderAppearance: string;
  bookReaderClose: string;
  bookReaderThemeLabel: string;
  bookReaderThemeApp: string;
  bookReaderThemePaper: string;
  bookReaderThemeSepia: string;
  bookReaderThemeGray: string;
  bookReaderThemeGreen: string;
  bookReaderThemeDark: string;
  bookReaderThemeNight: string;
  bookReaderThemeBlack: string;
  bookReaderThemeContrast: string;
  bookReaderFontLabel: string;
  bookReaderFontSizeLabel: string;
  configBookReadingTitle: string;
  bookReaderFontSerif: string;
  bookReaderFontSans: string;
  bookReaderFontMono: string;
  bookReaderLineSpacingLabel: string;
  bookReaderMarginLabel: string;
  bookReaderMarginNarrow: string;
  bookReaderMarginMedium: string;
  bookReaderMarginWide: string;
  bookReaderJustify: string;
  bookReaderModeLabel: string;
  bookReaderModeInfinite: string;
  bookReaderModePaged: string;

  // ── Search screen ────────────────────────────────────────────────────────
  searchPlaceholder: string;
  searchClear: string;
  searchLoading: string;
  searchError: string;
  searchRetry: string;
  searchNoResults: string;
  // "{0} resultados" — {0} is the count. Singular/plural handled by two separate strings so a
  // language can word them differently, rather than bolting an "s" onto one of them.
  searchResultCount: string;
  searchResultCountOne: string;
  searchEmptyHint: string;
  searchRecentTitle: string;
  searchRecentDelete: string;
  searchRecentDeleteConfirm: string;
  searchDeleteCancel: string;
  searchDeleteConfirm: string;

  // ── Splash screen ─────────────────────────────────────────────────────────
  splashVersion: string;
  splashUpdateButton: string;

  // ── OTA policy dialogs ───────────────────────────────────────────────────
  otaRequiredTitle: string;
  otaRequiredBody: string;
  otaHighlyRecTitle: string;
  otaRecommendedTitle: string;
  otaAdvisoryBody: string;
  otaDismiss: string;
  otaViewNotes: string;

  // ── Version labels ────────────────────────────────────────────────────────
  versionBackend: string;
  versionApp: string;
  versionFrontend: string;

  // ── Setup screen ─────────────────────────────────────────────────────────
  setupTitle: string;
  setupSubtitle: string;
  setupGoToLibrary: string;
  setupTestConnection: string;
  setupForceReselect: string;
  setupTesting: string;
  setupConnectionOk: string;
  setupAuthenticate: string;
  setupAuthenticating: string;
  setupAuthOk: string;
  setupApiKeyLabel: string;
  setupBffSection: string;
  setupBffTestConnection: string;
  setupBffConnectionOk: string;

  // ── Exit dialog ──────────────────────────────────────────────────────────
  exitTitle: string;
  exitMessage: string;
  exitCancel: string;
  exitConfirm: string;

  // ── Series detail screen ─────────────────────────────────────────────────
  seriesDetailLoading: string;
  seriesDetailError: string;
  seriesDetailRetry: string;
  seriesDetailStartReading: string;
  seriesDetailContinueReading: string;
  seriesDetailRereadFromStart: string;
  seriesDetailChaptersRead: string;
  // Shown when the enrichment server's data is missing from the page — 'Pending' while it is
  // still being fetched, 'Failed' when it could not be reached at all.
  seriesDetailEnrichmentPending: string;
  // Outcome of a fetch that finished after the page had already rendered without it.
  seriesDetailEnrichmentUpdated: string;
  seriesDetailEnrichmentUpdateFailed: string;
  seriesDetailEnrichmentFailed: string;
  seriesDetailAuthorLabel: string;
  seriesDetailAlternativeTitlesLabel: string;
  seriesDetailAbandonedLabel: string;
  seriesDetailDescriptionReadMore: string;
  seriesDetailDescriptionReadLess: string;
  seriesDetailChapterNumberLabel: string;
  seriesDetailChapterUntitled: string;
  seriesDetailSortAscending: string;
  seriesDetailSortDescending: string;
  seriesDetailSortAutoFixed: string;
  seriesDetailSortAutoProgress: string;
  seriesDetailSelectionMarkRead: string;
  seriesDetailSelectionMarkUnread: string;
  seriesDetailSelectionSelectAll: string;
  seriesDetailSelectionInvert: string;
  seriesDetailSelectionRange: string;
  seriesDetailRangeTitle: string;
  seriesDetailRangeFromLabel: string;
  seriesDetailRangeToLabel: string;
  seriesDetailRangeCancel: string;
  seriesDetailRangeApply: string;
  seriesDetailRangeInvalid: string;
  seriesDetailBackLabel: string;
  seriesDetailFollowLabel: string;
  seriesDetailUnfollowLabel: string;
  seriesDetailChapterMenuLabel: string;
  seriesDetailChapterMenuSort: string;
  seriesDetailChapterMenuRange: string;
  seriesDetailSortConfigTitle: string;
  seriesDetailSortConfigFixedThresholdLabel: string;
  seriesDetailSortConfigFixedThresholdHint: string;
  seriesDetailSortConfigProgressPercentLabel: string;
  seriesDetailSortConfigProgressPercentHint: string;
  seriesDetailSortConfigCancel: string;
  seriesDetailSortConfigSave: string;
  seriesDetailSortConfigReset: string;
  seriesDetailSortConfigOverrideNote: string;

  // ── Reader screen ────────────────────────────────────────────────────────
  readerLoading: string;
  readerError: string;
  readerRetry: string;
  // A single page failing inside the reader — distinct from readerError, which is the whole
  // chapter. The "…WithCode" variant carries {code} for a decode failure worth reporting.
  readerPageError: string;
  readerPageErrorWithCode: string;

  // ── Debug menu — reader page size ───────────────────────────────────────
  debugPageBudgetTitle: string;
  debugPageBudgetHint: string;

  // ── Debug menu — local diagnostics log ──────────────────────────────────
  debugLogTitle: string;
  debugLogHint: string;
  debugLogSize: string;
  debugLogAdb: string;
  debugLogExport: string;
  debugLogClear: string;
  debugLogRefresh: string;
  readerOffline: string;
  readerEndOfChapter: string;
  // Same message as readerEndOfChapter, but WITHOUT the {0} placeholder — the footer now renders
  // this prefix and the chapter number as two separate SduNode texts (so the number can be bold),
  // instead of one interpolated string. See ReaderScreen.tsx toBlock.
  readerEndOfChapterPrefix: string;
  readerNextChapterLabel: string;
  readerNoNextChapter: string;
  readerNoPrevChapter: string;
  // "Cap. {0} de {1}" — position of the open chapter in the series / chapters in the series, shown
  // in the top bar.
  readerChapterIndicator: string;
  readerChapterPickerButtonLabel: string;
  readerChapterPickerTitle: string;
  readerSettingsButtonLabel: string;
  readerPrevChapterButtonLabel: string;
  readerOpenSeriesLabel: string;
  readerNextChapterButtonLabel: string;
  readerSettingsCloseButtonLabel: string;
  readerProgressColorLabel: string;
  readerProgressColorDefault: string;
  readerProgressPositionLabel: string;
  readerProgressPositionLeft: string;
  readerProgressPositionRight: string;
  readerProgressPositionTop: string;
  readerProgressPositionBottom: string;

  // ── Errors ───────────────────────────────────────────────────────────────
  errorApiKeyEmpty: string;
  errorDbVersionMismatch: string;
  errorDbNotOpen: string;

  // ── Relative time (DateTool.format.to.relative) ──────────────────────────
  dateJustNow: string;
  dateMinutesAgo: string; // "{0}" = minutes ("há {0} minuto(s)")
  dateHoursAgo: string; // "{0}" = hours ("há {0} hora(s)")
  dateDaysAgo: string; // "{0}" = days ("há {0} dia(s)")

  // ── Library freshness banner ────────────────────────────────────────────
  libraryUpdatedAgo: string; // "{0}" = DateTool relative text — "Atualizado {0}"
  libraryUpdatedAt: string; // "{0}" = absolute HH:MM:SS — shown briefly after a network refresh
  libraryOfflineStale: string; // "{0}" = relative text — "(Sem conexão) Atualizado {0}"
  libraryOfflineNoDate: string; // couldn't reach the server and no cache timestamp known

  // ── Server screen (Task 035 — server + metadata server sections) ─────────
  serverSectionTitle: string; // "{0}" = provider display name — "Servidores {0}"
  serverMetadataSectionFallback: string; // when the metadata provider name isn't loaded yet
  serverAddServer: string;
  serverAddMetadataServer: string;
  serverUrlsLabel: string;
  serverAddUrl: string;
  serverModalNewTitle: string;
  serverModalEditTitle: string;
  serverModalProviderLabel: string;
  serverModalNameLabel: string;
  serverModalNamePlaceholder: string;
  urlModalNewTitle: string;
  urlModalEditTitle: string;
  urlModalUrlLabel: string;
  urlModalUrlPlaceholder: string;
  urlModalTestConnection: string;
  urlModalTesting: string;
  urlModalTestOk: string;
  urlModalTestFail: string;
  urlModalServerLabel: string;
  urlModalAssociateToUrl: string;
  urlModalNoUrlsInServer: string;
  urlModalPickServer: string;
  urlModalPickUrl: string;
  selectPlaceholder: string;
  serverConnErrorNoUrl: string;
  serverConnErrorNoActiveGroup: string;
  serverConnErrorGeneric: string;
  serverErrorNoProvider: string;
  serverErrorNoMetadataProvider: string;
  serverErrorNoServerToEdit: string;
  serverErrorNoMetadataServerToEdit: string;
  serverErrorNoServer: string;
  serverErrorNoMetadataServer: string;
  serverErrorUrlInvalid: string;

  // ── Notifications config screen (Plan 008 Task 008) ──────────────────────
  notificationsSectionTitle: string;
  notificationsChannelRowLabel: string;
  notificationsChannelStateOn: string;
  notificationsChannelStateOff: string;
  notificationsChannelOpenSettings: string;
  notificationsScopeAll: string;
  notificationsScopeFollowedOnly: string;
  notificationsGroupAcrossSeries: string;
  notificationsCollapseSerialChaptersNotification: string;
  notificationsRetentionLabel: string;
  notificationsRetentionDaysSuffix: string;
  notificationsRetentionDecreaseLabel: string;
  notificationsRetentionIncreaseLabel: string;
  notificationsGroupsTitle: string;
  notificationsAddGroup: string;
  notificationsGroupModalNewTitle: string;
  notificationsGroupModalEditTitle: string;
  notificationsGroupModalNameLabel: string;
  notificationsGroupModalNamePlaceholder: string;
  notificationsGroupModalTopicLabel: string;
  notificationsGroupModalTopicPlaceholder: string;
  notificationsUrlModalNewTitle: string;
  notificationsUrlModalEditTitle: string;
  notificationsUrlModalUrlLabel: string;
  notificationsUrlModalUrlPlaceholder: string;
  notificationsErrorNoGroup: string;
  notificationsErrorGroupNameRequired: string;
  notificationsErrorTopicRequired: string;
  notificationsErrorUrlInvalid: string;
  // The foreground service's own live status — see useNotificationServiceStatus's own doc.
  notificationsServiceStatusStopped: string;
  notificationsServiceStatusConnecting: string;
  notificationsServiceStatusConnected: string;
  notificationsServiceStatusDisconnected: string;

  // ── Notifications history screen (Plan 008 Task 009) ─────────────────────
  notificationsHistoryTitle: string;
  notificationsHistoryEmpty: string;
  notificationsHistoryMarkAllRead: string;
  notificationsHistoryDelete: string;
  notificationsHistoryBodyBatch: string; // "{0}" = chapter count
  notificationsHistoryBodyNumbered: string; // "{0}" = chapter number
  notificationsHistoryBodyUnnumbered: string;
  // Header count — "{0}" = unread, "{1}" = total. Shown only when there's at least one unread;
  // when everything is read, notificationsHistoryTotalCountAllRead ("{0}" = total) is used
  // instead, since "x/y" reading "12/12" would be redundant with "all of them."
  notificationsHistoryTotalCount: string;
  notificationsHistoryTotalCountAllRead: string;
  notificationsHistoryInfo: string;

  // ── In-app notification toast (a notification arriving while the app is open) ──
  notificationToastSummary: string; // "{0}" = how many series have news
  notificationToastOpen: string; // a11y: expands the pill into the list
  notificationToastClose: string; // a11y: closes the expanded list
  // Selection mode (long-press a row) — mirrors seriesDetailSelection* naming.
  notificationsHistorySelectionSelectAll: string;
  notificationsHistorySelectionMarkRead: string;
  notificationsHistorySelectionMarkUnread: string;
  notificationsHistorySelectionDelete: string;
  // Delete confirmation dialog — shown for every delete (single or bulk).
  notificationsHistoryDeleteConfirmTitleOne: string;
  notificationsHistoryDeleteConfirmTitleMany: string; // "{0}" = count
  notificationsHistoryDeleteConfirmCancel: string;
  notificationsHistoryDeleteConfirmConfirm: string;
  // Detail popup (tap the info icon on a row).
  notificationsHistoryDetailTitle: string;
  notificationsHistoryDetailChaptersTitle: string; // heading over the group's chapter list
  notificationsHistoryDetailGoToSeries: string;
  notificationsHistoryDetailMarkUnread: string;
  notificationsHistoryDetailDelete: string;
  notificationsHistoryDetailClose: string;
}

const ptBR: Strings = {
  commonBackLabel: 'Voltar',
  commonCloseLabel: 'Fechar',
  commonMoreOptionsLabel: 'Mais opções',
  commonScrollToTopLabel: 'Voltar ao topo',

  configTitle: 'Configurações',
  configLoadError: 'Erro ao carregar',
  configKavitaServers: 'Servidores Kavita',
  configAddServer: '+ Adicionar servidor',
  configAuth: 'Autenticação',
  configApiKeySet: 'API Key configurada',
  configNoApiKey: 'Sem API Key',
  configPreferences: 'Preferências',
  configKeepScreenOn: 'Manter tela ligada durante leitura',
  configImmersiveMode: 'Tela cheia imersiva ao ler',
  configLanguage: 'Idioma',
  configLanguagePtBr: 'Português',
  configLanguageEn: 'English',
  configMenuServer: 'Servidor',
  configMenuReading: 'Preferências de leitura',
  configMenuSerials: 'Página do mangá',
  configMenuNotifications: 'Notificações',
  configMenuTheme: 'Tema',
  configMenuAdult: 'Conteúdo sensível',
  adultReveal: 'Exibir conteúdo filtrado',
  adultRevealHint: 'Desligado, o conteúdo do filtro fica oculto. Ligado, aparece desfocado.',
  adultOnlyButton: 'Mostrar só este conteúdo',
  adultOnlyButtonOff: 'Voltar ao normal',
  adultOnlyHint: 'Vale só até fechar o app: ao abrir de novo, tudo volta ao normal.',
  adultCategoriesSelected: 'No filtro',
  adultCategoriesAvailable: 'Toque para adicionar',
  adultCategoriesNoneSelected: 'Nenhuma categoria no filtro',
  adultCategoriesRemove: 'Remover {0}',
  adultUnblur: 'Remover o desfoque',
  adultCategories: 'Categorias do filtro',
  adultCategoriesHint: 'Obras com qualquer uma das categorias do filtro entram nele. Sem nenhuma, nada é filtrado.',
  adultCategoriesEmpty: 'Este servidor não oferece categorias',
  adultCategoriesError: 'Não foi possível carregar as categorias',
  configMenuStartScreen: 'Tela inicial',
  configStartScreenHome: 'Home',
  configStartScreenFollowing: 'Favoritos',
  themeNameTeal: 'Petróleo',
  themeNameCrimson: 'Carmim',
  themeNameOnyx: 'Ônix',
  themeNameAmber: 'Âmbar',
  themeNameSepia: 'Sépia',
  themeNameSteel: 'Aço',
  themeNameWine: 'Vinho',
  themeNameForest: 'Floresta',
  themeOledSuffix: 'OLED',
  themeDefaultSuffix: 'padrão',
  configMetadataSourceGroupTitle: 'Fonte dos dados',
  configMetadataSourceRowLabel: 'Servidor principal',
  configMetadataSourceEnrichment: 'Servidor de enriquecimento',
  configMetadataSourceContent: 'Servidor de conteúdo',
  configMetadataSourceEnrichmentShort: 'Enriquecimento',
  configMetadataSourceContentShort: 'Conteúdo',
  configMetadataSourceFieldsTitle: 'Campos individuais',
  configMetadataSourceFieldsHint: 'Escolha um servidor por campo. Se o escolhido não tiver o dado, o outro é usado.',
  configMetadataSourceInherit: 'Seguir o principal',
  configMetadataFieldSummary: 'Sinopse',
  configMetadataFieldGenres: 'Gêneros',
  configMetadataFieldAuthor: 'Autor',
  configMetadataFieldStatus: 'Status',
  configMetadataFieldAlternativeTitles: 'Outros títulos',
  configChapterSortGroupTitle: 'Ordenação de capítulos',

  serverFormUrlLabel: 'URL do servidor',
  serverFormUrlPlaceholder: 'http://192.168.1.100:5000',
  serverFormTimeoutLabel: 'Timeout (ms)',
  serverFormPriorityLabel: 'Prioridade',
  serverFormHealthCheckLabel: 'Health check path',
  serverFormCancel: 'Cancelar',
  serverFormSave: 'Salvar',

  serverListEmpty: 'Nenhum servidor configurado',
  serverListPriority: 'Prioridade',
  serverListEdit: 'Editar',
  serverListDelete: 'Excluir',

  apiKeyChange: 'Alterar',
  apiKeyPlaceholder: 'Cole aqui a API key do Kavita',
  apiKeyCancel: 'Cancelar',
  apiKeySave: 'Salvar API Key',

  bffServers: 'Servidor BFF',
  bffAddServer: '+ Adicionar URL do BFF',
  bffUrlLabel: 'URL do BFF',
  bffUrlPlaceholder: 'http://192.168.1.100:8080',
  bffLinkKavitaLabel: 'Vincular a um servidor Kavita (opcional)',
  bffLinkKavitaNone: 'Nenhum',
  bffPathLabel: 'Path da API',
  bffPathPlaceholder: '/manga',
  bffAdd: 'Adicionar',
  bffRemove: 'Remover',
  bffLinkedTo: 'Vinculado a',

  libraryTitle: 'Biblioteca',
  libraryLoading: 'Carregando...',
  libraryEmpty: 'Nenhuma série encontrada',
  libraryError: 'Erro ao carregar a biblioteca',
  libraryRetry: 'Tentar novamente',
  librarySortRecentlyUpdated: 'Atualizado recentemente',
  librarySortAlphabetical: 'Alfabético',
  libraryViewGrid: 'Grade',
  libraryViewList: 'Lista',
  librarySeriesCount: 'séries',
  libraryFilterButtonLabel: 'Filtrar',
  libraryFilterMenuTitle: 'Filtrar por status de leitura',
  libraryFilterClearAll: 'Limpar filtro',
  libraryFilterNoResults: 'Nenhuma série encontrada com esse filtro',

  followingEmpty: 'Nenhuma série seguida. Marque séries na Biblioteca para vê-las aqui.',

  readStatusUnread: 'Não lido',
  readStatusReading: 'Lendo',
  readStatusRead: 'Lido',
  publicationOngoing: 'Em andamento',
  publicationCompleted: 'Completo',
  publicationCancelled: 'Cancelado',
  publicationOnHiatus: 'Hiato',
  publicationAbandoned: 'Abandonado',
  chaptersFormat: 'caps.',
  hasErrors: 'Erros',

  bottomBarLibrary: 'Biblioteca',
  bottomBarSettings: 'Ajustes',

  navLibrary: 'Biblioteca',
  navDashboard: 'Home',
  navFollowing: 'Seguindo',
  navSearch: 'Buscar',
  navNotifications: 'Notificações',
  navConfig: 'Ajustes',

  dashboardContinueReading: 'Continuar lendo',
  dashboardFollowedUpdated: 'Obras seguidas atualizadas',
  dashboardRecentlyUpdated: 'Atualizadas recentemente',
  dashboardUnfinished: 'Ainda não terminei…',
  dashboardRecentlyAdded: 'Novas na biblioteca',
  dashboardChapter: 'Cap. {0}',
  dashboardPercentRead: '{0}% lido',
  dashboardNextChapter: 'Próximo: Cap. {0}',
  serieBadgeNovel: 'Novel',
  serieBadgePdf: 'PDF',
  dashboardStatSeries: 'Obras',
  dashboardStatFollowed: 'Seguidas',
  dashboardStatInProgress: 'Em andamento',
  dashboardError: 'Não foi possível carregar a Home',
  dashboardRetry: 'Tentar novamente',
  bookReaderLoading: 'Carregando capítulo…',
  bookReaderError: 'Não foi possível abrir este capítulo',
  bookReaderRetry: 'Tentar novamente',
  bookReaderFontSmaller: 'Diminuir o texto',
  bookReaderFontLarger: 'Aumentar o texto',
  bookReaderPrevPage: 'Página anterior',
  bookReaderNextPage: 'Próxima página',
  bookReaderPage: 'Página {0} de {1}',
  bookReaderAppearance: 'Aparência',
  bookReaderClose: 'Fechar',
  bookReaderThemeLabel: 'Tema',
  bookReaderThemeApp: 'Do app',
  bookReaderThemePaper: 'Papel',
  bookReaderThemeSepia: 'Sépia',
  bookReaderThemeGray: 'Cinza',
  bookReaderThemeGreen: 'Verde',
  bookReaderThemeDark: 'Escuro',
  bookReaderThemeNight: 'Noite',
  bookReaderThemeBlack: 'Preto',
  bookReaderThemeContrast: 'Alto contraste',
  bookReaderFontLabel: 'Fonte',
  bookReaderFontSizeLabel: 'Tamanho do texto',
  configBookReadingTitle: 'Leitura de novel',
  bookReaderFontSerif: 'Com serifa',
  bookReaderFontSans: 'Sem serifa',
  bookReaderFontMono: 'Monoespaçada',
  bookReaderLineSpacingLabel: 'Entrelinha',
  bookReaderMarginLabel: 'Margens',
  bookReaderMarginNarrow: 'Estreitas',
  bookReaderMarginMedium: 'Médias',
  bookReaderMarginWide: 'Largas',
  bookReaderJustify: 'Texto justificado',
  bookReaderModeLabel: 'Modo de leitura',
  bookReaderModeInfinite: 'Infinito',
  bookReaderModePaged: 'Paginado',
  searchPlaceholder: 'Buscar por nome',
  searchClear: 'Limpar busca',
  searchLoading: 'Carregando séries...',
  searchError: 'Não foi possível carregar as séries',
  searchRetry: 'Tentar novamente',
  searchNoResults: 'Nenhuma série encontrada',
  searchResultCount: '{0} resultados',
  searchResultCountOne: '1 resultado',
  searchEmptyHint: 'Digite para buscar na sua biblioteca',
  searchRecentTitle: 'Abertas recentemente',
  searchRecentDelete: 'Remover do histórico',
  searchRecentDeleteConfirm: 'Remover esta série do histórico?',
  searchDeleteCancel: 'Cancelar',
  searchDeleteConfirm: 'Remover',

  splashVersion: 'v',
  splashUpdateButton: 'Aplicar atualização',

  otaRequiredTitle: 'Atualização obrigatória',
  otaRequiredBody: 'Esta versão não é mais suportada. Para continuar usando o app, acesse as notas de versão e instale a atualização.',
  otaHighlyRecTitle: 'Atualização altamente recomendada',
  otaRecommendedTitle: 'Nova versão disponível',
  otaAdvisoryBody: 'Uma nova versão do app está disponível. Recomendamos atualizar para ter a melhor experiência.',
  otaDismiss: 'Agora não',
  otaViewNotes: 'Ver novidades',

  versionBackend: 'backend',
  versionApp: 'app',
  versionFrontend: 'frontend',

  setupTitle: 'Bem-vindo',
  setupSubtitle: 'Configure seu servidor Kavita para começar.',
  setupGoToLibrary: 'Ir para a Biblioteca',
  setupTestConnection: 'Testar conexão',
  setupForceReselect: 'Forçar reconfiguração',
  setupTesting: 'Testando...',
  setupConnectionOk: 'Conexão OK',
  setupAuthenticate: 'Autenticar',
  setupAuthenticating: 'Autenticando...',
  setupAuthOk: 'Autenticado',
  setupApiKeyLabel: 'API Key do Kavita',
  setupBffSection: 'Servidor BFF (opcional)',
  setupBffTestConnection: 'Testar BFF',
  setupBffConnectionOk: 'BFF OK',

  exitTitle: 'Sair do app',
  exitMessage: 'Deseja fechar o aplicativo?',
  exitCancel: 'Cancelar',
  exitConfirm: 'Sair',

  seriesDetailLoading: 'Carregando...',
  seriesDetailError: 'Erro ao carregar a série',
  seriesDetailRetry: 'Tentar novamente',
  seriesDetailStartReading: 'Começar a ler',
  seriesDetailContinueReading: 'Continuar lendo - {0}',
  seriesDetailRereadFromStart: 'Reler',
  seriesDetailChaptersRead: '{0}/{1} lidos',
  seriesDetailEnrichmentPending: 'Buscando dados complementares...',
  seriesDetailEnrichmentUpdated: 'Dados complementares atualizados',
  seriesDetailEnrichmentUpdateFailed: 'Não foi possível atualizar os dados complementares',
  seriesDetailEnrichmentFailed: 'Dados incompletos — servidor de enriquecimento indisponível',
  seriesDetailAuthorLabel: 'Autor',
  seriesDetailAlternativeTitlesLabel: 'Outros títulos',
  seriesDetailAbandonedLabel: 'Abandonado pela fonte',
  seriesDetailDescriptionReadMore: 'Ler mais',
  seriesDetailDescriptionReadLess: 'Ler menos',
  seriesDetailChapterNumberLabel: 'Capítulo {0}',
  seriesDetailChapterUntitled: 'Sem título',
  seriesDetailSortAscending: 'Crescente',
  seriesDetailSortDescending: 'Decrescente',
  seriesDetailSortAutoFixed: 'Auto (cap. {0})',
  seriesDetailSortAutoProgress: 'Auto ({0}%)',
  seriesDetailSelectionMarkRead: 'Marcar como lido',
  seriesDetailSelectionMarkUnread: 'Marcar como não lido',
  seriesDetailSelectionSelectAll: 'Selecionar tudo',
  seriesDetailSelectionInvert: 'Inverter seleção',
  seriesDetailSelectionRange: 'Selecionar intervalo',
  seriesDetailRangeTitle: 'Selecionar intervalo de capítulos',
  seriesDetailRangeFromLabel: 'De',
  seriesDetailRangeToLabel: 'Até',
  seriesDetailRangeCancel: 'Cancelar',
  seriesDetailRangeApply: 'Selecionar',
  seriesDetailRangeInvalid: 'Informe um intervalo válido',
  seriesDetailBackLabel: 'Voltar',
  seriesDetailFollowLabel: 'Seguir série',
  seriesDetailUnfollowLabel: 'Deixar de seguir série',
  seriesDetailChapterMenuLabel: 'Opções da lista de capítulos',
  seriesDetailChapterMenuSort: 'Ordenação',
  seriesDetailChapterMenuRange: 'Selecionar intervalo',
  seriesDetailSortConfigTitle: 'Ordenação de capítulos',
  seriesDetailSortConfigFixedThresholdLabel: 'Capítulo limiar',
  seriesDetailSortConfigFixedThresholdHint: 'Decrescente a partir deste capítulo',
  seriesDetailSortConfigProgressPercentLabel: 'Percentual de progresso',
  seriesDetailSortConfigProgressPercentHint: 'Decrescente a partir deste percentual (0–100)',
  seriesDetailSortConfigCancel: 'Cancelar',
  seriesDetailSortConfigSave: 'Salvar',
  seriesDetailSortConfigReset: 'Usar padrão do app',
  seriesDetailSortConfigOverrideNote: 'Esta série tem uma ordenação própria, diferente do padrão do app.',

  readerLoading: 'Carregando...',
  readerError: 'Erro ao carregar o capítulo',
  readerRetry: 'Tentar novamente',
  readerPageError: 'Falha ao carregar página',
  readerPageErrorWithCode: 'Falha ao carregar página ({code})',
  debugPageBudgetTitle: 'Tamanho máximo da página',
  debugPageBudgetHint:
    'Páginas altas são reduzidas para caber neste tamanho. Menor = mais fluido, maior = mais nítido. Vale para páginas carregadas depois da troca.',
  debugLogTitle: 'Log de diagnóstico',
  debugLogHint:
    'Arquivo local com erros, travamentos e o motivo de o app ter fechado. Não sai do aparelho: leia pelo comando abaixo ou exporte.',
  debugLogSize: 'Tamanho',
  debugLogAdb: 'Ler pelo computador',
  debugLogExport: 'Exportar',
  debugLogClear: 'Limpar',
  debugLogRefresh: 'Atualizar',
  readerOffline: 'Sem conexão',
  readerEndOfChapter: 'Fim do capítulo {0}',
  readerEndOfChapterPrefix: 'Fim do capítulo',
  readerNextChapterLabel: 'Próximo:',
  readerNoNextChapter: 'Não há próximo capítulo',
  readerNoPrevChapter: 'Não há capítulo anterior',
  readerChapterIndicator: 'Cap. {0} de {1}',
  readerChapterPickerButtonLabel: 'Selecionar capítulo',
  readerChapterPickerTitle: 'Capítulos',
  readerSettingsButtonLabel: 'Ajustes de leitura',
  readerPrevChapterButtonLabel: 'Capítulo anterior',
  readerOpenSeriesLabel: 'Ir para a obra',
  readerNextChapterButtonLabel: 'Próximo capítulo',
  readerSettingsCloseButtonLabel: 'Fechar',
  readerProgressColorLabel: 'Cor do progresso de leitura',
  readerProgressColorDefault: 'Padrão do tema',
  readerProgressPositionLabel: 'Posição do indicador de progresso',
  readerProgressPositionLeft: 'Esquerda',
  readerProgressPositionRight: 'Direita',
  readerProgressPositionTop: 'Topo',
  readerProgressPositionBottom: 'Rodapé',

  errorApiKeyEmpty: 'A API key não pode estar vazia',
  errorDbVersionMismatch: 'Versão do banco incompatível',
  errorDbNotOpen: 'Banco de dados não está aberto',

  dateJustNow: 'agora',
  dateMinutesAgo: 'há {0} minuto(s)',
  dateHoursAgo: 'há {0} hora(s)',
  dateDaysAgo: 'há {0} dia(s)',

  libraryUpdatedAgo: 'Atualizado {0}',
  libraryUpdatedAt: 'Atualizado às {0}',
  libraryOfflineStale: '(Sem conexão) Atualizado {0}',
  libraryOfflineNoDate: 'Sem conexão — mostrando dados salvos',

  serverSectionTitle: 'Servidores {0}',
  serverMetadataSectionFallback: 'Servidores de metadados',
  serverAddServer: '+ Adicionar servidor',
  serverAddMetadataServer: '+ Adicionar servidor de metadados',
  serverUrlsLabel: 'URLs',
  serverAddUrl: '+ Adicionar URL',
  serverModalNewTitle: 'Novo servidor',
  serverModalEditTitle: 'Editar servidor',
  serverModalProviderLabel: 'Provedor',
  serverModalNameLabel: 'Nome',
  serverModalNamePlaceholder: 'Servidor de casa',
  urlModalNewTitle: 'Nova URL',
  urlModalEditTitle: 'Editar URL',
  urlModalUrlLabel: 'URL',
  urlModalUrlPlaceholder: 'http://192.168.1.100:5000',
  urlModalTestConnection: 'Testar conexão',
  urlModalTesting: 'Testando…',
  urlModalTestOk: 'conectou',
  urlModalTestFail: 'falhou',
  urlModalServerLabel: 'Servidor',
  urlModalAssociateToUrl: 'Associar a uma URL do servidor',
  urlModalNoUrlsInServer: 'Nenhuma URL nesse servidor',
  urlModalPickServer: 'Selecione um servidor',
  urlModalPickUrl: 'Selecione uma URL',
  selectPlaceholder: 'Selecione…',
  serverConnErrorNoUrl: 'Nenhuma URL respondeu. Verifique os endereços e se o servidor está no ar.',
  serverConnErrorNoActiveGroup: 'Nenhum servidor ativo.',
  serverConnErrorGeneric: 'Não foi possível conectar.',
  serverErrorNoProvider: 'Nenhum provedor de servidor disponível',
  serverErrorNoMetadataProvider: 'Nenhum provedor de servidor de metadados disponível',
  serverErrorNoServerToEdit: 'Nenhum servidor para editar',
  serverErrorNoMetadataServerToEdit: 'Nenhum servidor de metadados para editar',
  serverErrorNoServer: 'Nenhum servidor',
  serverErrorNoMetadataServer: 'Nenhum servidor de metadados',
  serverErrorUrlInvalid: 'URL inválida (use http:// ou https://)',

  notificationsSectionTitle: 'Notificações',
  notificationsChannelRowLabel: 'Notificações do sistema',
  notificationsChannelStateOn: 'Ativadas',
  notificationsChannelStateOff: 'Desativadas',
  notificationsChannelOpenSettings: 'Abrir configurações',
  notificationsScopeAll: 'Notificar sobre todas as séries',
  notificationsScopeFollowedOnly: 'Notificar apenas séries seguidas',
  notificationsGroupAcrossSeries: 'Agrupar notificações de várias séries',
  notificationsCollapseSerialChaptersNotification: 'Agrupar capítulos próximos da mesma série no histórico',
  notificationsRetentionLabel: 'Manter histórico por',
  notificationsRetentionDaysSuffix: 'dias',
  notificationsRetentionDecreaseLabel: 'Diminuir dias de retenção',
  notificationsRetentionIncreaseLabel: 'Aumentar dias de retenção',
  notificationsGroupsTitle: 'Servidores de notificação',
  notificationsAddGroup: '+ Adicionar servidor de notificação',
  notificationsGroupModalNewTitle: 'Novo servidor de notificação',
  notificationsGroupModalEditTitle: 'Editar servidor de notificação',
  notificationsGroupModalNameLabel: 'Nome',
  notificationsGroupModalNamePlaceholder: 'Casa',
  notificationsGroupModalTopicLabel: 'Tópico',
  notificationsGroupModalTopicPlaceholder: 'novos-capitulos',
  notificationsUrlModalNewTitle: 'Nova URL',
  notificationsUrlModalEditTitle: 'Editar URL',
  notificationsUrlModalUrlLabel: 'URL',
  notificationsUrlModalUrlPlaceholder: 'https://ntfy.sh',
  notificationsErrorNoGroup: 'Nenhum servidor de notificação',
  notificationsErrorGroupNameRequired: 'Nome obrigatório',
  notificationsErrorTopicRequired: 'Tópico obrigatório',
  notificationsErrorUrlInvalid: 'URL inválida (use http:// ou https://)',
  notificationsServiceStatusStopped: 'Parado',
  notificationsServiceStatusConnecting: 'Conectando…',
  notificationsServiceStatusConnected: 'Conectado',
  notificationsServiceStatusDisconnected: 'Desconectado',

  notificationsHistoryTitle: 'Notificações',
  notificationsHistoryEmpty: 'Nenhuma notificação ainda',
  notificationsHistoryMarkAllRead: 'Marcar tudo como lido',
  notificationsHistoryDelete: 'Excluir',
  notificationsHistoryBodyBatch: '{0} novos capítulos disponíveis',
  notificationsHistoryBodyNumbered: 'Capítulo {0} disponível',
  notificationsHistoryBodyUnnumbered: 'Novo capítulo disponível',
  notificationsHistoryTotalCount: '{0}/{1} notificações',
  notificationsHistoryTotalCountAllRead: '{0} notificações',
  notificationToastSummary: '{0} novas notificações',
  notificationToastOpen: 'Ver o que chegou',
  notificationToastClose: 'Fechar notificações',
  notificationsHistoryInfo: 'Mais informações',
  notificationsHistorySelectionSelectAll: 'Selecionar tudo',
  notificationsHistorySelectionMarkRead: 'Marcar como lido',
  notificationsHistorySelectionMarkUnread: 'Marcar como não lido',
  notificationsHistorySelectionDelete: 'Excluir',
  notificationsHistoryDeleteConfirmTitleOne: 'Excluir esta notificação?',
  notificationsHistoryDeleteConfirmTitleMany: 'Excluir {0} notificações?',
  notificationsHistoryDeleteConfirmCancel: 'Cancelar',
  notificationsHistoryDeleteConfirmConfirm: 'Excluir',
  notificationsHistoryDetailTitle: 'Detalhes da notificação',
  notificationsHistoryDetailChaptersTitle: 'Capítulos incluídos',
  notificationsHistoryDetailGoToSeries: 'Ir para a série',
  notificationsHistoryDetailMarkUnread: 'Marcar como não lido',
  notificationsHistoryDetailDelete: 'Excluir',
  notificationsHistoryDetailClose: 'Fechar',
};

const en: Strings = {
  commonBackLabel: 'Back',
  commonCloseLabel: 'Close',
  commonMoreOptionsLabel: 'More options',
  commonScrollToTopLabel: 'Scroll to top',

  configTitle: 'Settings',
  configLoadError: 'Load error',
  configKavitaServers: 'Kavita Servers',
  configAddServer: '+ Add server',
  configAuth: 'Authentication',
  configApiKeySet: 'API Key set',
  configNoApiKey: 'No API Key',
  configPreferences: 'Preferences',
  configKeepScreenOn: 'Keep screen on while reading',
  configImmersiveMode: 'Immersive fullscreen while reading',
  configLanguage: 'Language',
  configLanguagePtBr: 'Português',
  configLanguageEn: 'English',
  configMenuServer: 'Server',
  configMenuReading: 'Reading preferences',
  configMenuSerials: 'Manga page',
  configMenuNotifications: 'Notifications',
  configMenuTheme: 'Theme',
  configMenuAdult: 'Sensitive content',
  adultReveal: 'Show filtered content',
  adultRevealHint: 'Off, filtered content stays hidden. On, it shows blurred.',
  adultOnlyButton: 'Show only this content',
  adultOnlyButtonOff: 'Back to normal',
  adultOnlyHint: 'Lasts only until the app is closed: the next time it opens, everything is back to normal.',
  adultCategoriesSelected: 'In the filter',
  adultCategoriesAvailable: 'Tap to add',
  adultCategoriesNoneSelected: 'No category in the filter',
  adultCategoriesRemove: 'Remove {0}',
  adultUnblur: 'Remove the blur',
  adultCategories: 'Filter categories',
  adultCategoriesHint: 'Series with any category in the filter fall under it. With none, nothing is filtered.',
  adultCategoriesEmpty: 'This server offers no categories',
  adultCategoriesError: 'Could not load the categories',
  configMenuStartScreen: 'Start screen',
  configStartScreenHome: 'Home',
  configStartScreenFollowing: 'Favorites',
  themeNameTeal: 'Teal',
  themeNameCrimson: 'Crimson',
  themeNameOnyx: 'Onyx',
  themeNameAmber: 'Amber',
  themeNameSepia: 'Sepia',
  themeNameSteel: 'Steel',
  themeNameWine: 'Wine',
  themeNameForest: 'Forest',
  themeOledSuffix: 'OLED',
  themeDefaultSuffix: 'default',
  configMetadataSourceGroupTitle: 'Data source',
  configMetadataSourceRowLabel: 'Primary server',
  configMetadataSourceEnrichment: 'Enrichment server',
  configMetadataSourceContent: 'Content server',
  configMetadataSourceEnrichmentShort: 'Enrichment',
  configMetadataSourceContentShort: 'Content',
  configMetadataSourceFieldsTitle: 'Individual fields',
  configMetadataSourceFieldsHint: 'Pick a server per field. If it has no answer, the other one is used.',
  configMetadataSourceInherit: 'Follow the primary',
  configMetadataFieldSummary: 'Summary',
  configMetadataFieldGenres: 'Genres',
  configMetadataFieldAuthor: 'Author',
  configMetadataFieldStatus: 'Status',
  configMetadataFieldAlternativeTitles: 'Other titles',
  configChapterSortGroupTitle: 'Chapter sort order',

  serverFormUrlLabel: 'Server URL',
  serverFormUrlPlaceholder: 'http://192.168.1.100:5000',
  serverFormTimeoutLabel: 'Timeout (ms)',
  serverFormPriorityLabel: 'Priority',
  serverFormHealthCheckLabel: 'Health check path',
  serverFormCancel: 'Cancel',
  serverFormSave: 'Save',

  serverListEmpty: 'No servers configured',
  serverListPriority: 'Priority',
  serverListEdit: 'Edit',
  serverListDelete: 'Delete',

  apiKeyChange: 'Change',
  apiKeyPlaceholder: 'Paste your Kavita API key here',
  apiKeyCancel: 'Cancel',
  apiKeySave: 'Save API Key',

  bffServers: 'BFF Server',
  bffAddServer: '+ Add BFF URL',
  bffUrlLabel: 'BFF URL',
  bffUrlPlaceholder: 'http://192.168.1.100:8080',
  bffLinkKavitaLabel: 'Link to a Kavita server (optional)',
  bffLinkKavitaNone: 'None',
  bffPathLabel: 'API path',
  bffPathPlaceholder: '/manga',
  bffAdd: 'Add',
  bffRemove: 'Remove',
  bffLinkedTo: 'Linked to',

  libraryTitle: 'Library',
  libraryLoading: 'Loading...',
  libraryEmpty: 'No series found',
  libraryError: 'Failed to load library',
  libraryRetry: 'Try again',
  librarySortRecentlyUpdated: 'Recently updated',
  librarySortAlphabetical: 'Alphabetical',
  libraryViewGrid: 'Grid',
  libraryViewList: 'List',
  librarySeriesCount: 'series',
  libraryFilterButtonLabel: 'Filter',
  libraryFilterMenuTitle: 'Filter by reading status',
  libraryFilterClearAll: 'Clear filter',
  libraryFilterNoResults: 'No series match this filter',

  followingEmpty: 'No series followed. Star series in the Library to see them here.',

  readStatusUnread: 'Unread',
  readStatusReading: 'Reading',
  readStatusRead: 'Read',
  publicationOngoing: 'Ongoing',
  publicationCompleted: 'Completed',
  publicationCancelled: 'Cancelled',
  publicationOnHiatus: 'On hiatus',
  publicationAbandoned: 'Abandoned',
  chaptersFormat: 'chs.',
  hasErrors: 'Errors',

  bottomBarLibrary: 'Library',
  bottomBarSettings: 'Settings',

  navLibrary: 'Library',
  navDashboard: 'Home',
  navFollowing: 'Following',
  navSearch: 'Search',
  navNotifications: 'Notifications',
  navConfig: 'Settings',

  dashboardContinueReading: 'Continue reading',
  dashboardFollowedUpdated: 'Followed series updated',
  dashboardRecentlyUpdated: 'Recently updated',
  dashboardUnfinished: 'Not finished yet…',
  dashboardRecentlyAdded: 'New in library',
  dashboardChapter: 'Ch. {0}',
  dashboardPercentRead: '{0}% read',
  dashboardNextChapter: 'Next: Ch. {0}',
  serieBadgeNovel: 'Novel',
  serieBadgePdf: 'PDF',
  dashboardStatSeries: 'Series',
  dashboardStatFollowed: 'Following',
  dashboardStatInProgress: 'In progress',
  dashboardError: 'Could not load Home',
  dashboardRetry: 'Try again',
  bookReaderLoading: 'Loading chapter…',
  bookReaderError: 'Could not open this chapter',
  bookReaderRetry: 'Try again',
  bookReaderFontSmaller: 'Smaller text',
  bookReaderFontLarger: 'Larger text',
  bookReaderPrevPage: 'Previous page',
  bookReaderNextPage: 'Next page',
  bookReaderPage: 'Page {0} of {1}',
  bookReaderAppearance: 'Appearance',
  bookReaderClose: 'Close',
  bookReaderThemeLabel: 'Theme',
  bookReaderThemeApp: 'App theme',
  bookReaderThemePaper: 'Paper',
  bookReaderThemeSepia: 'Sepia',
  bookReaderThemeGray: 'Gray',
  bookReaderThemeGreen: 'Green',
  bookReaderThemeDark: 'Dark',
  bookReaderThemeNight: 'Night',
  bookReaderThemeBlack: 'Black',
  bookReaderThemeContrast: 'High contrast',
  bookReaderFontLabel: 'Font',
  bookReaderFontSizeLabel: 'Text size',
  configBookReadingTitle: 'Novel reading',
  bookReaderFontSerif: 'Serif',
  bookReaderFontSans: 'Sans serif',
  bookReaderFontMono: 'Monospace',
  bookReaderLineSpacingLabel: 'Line spacing',
  bookReaderMarginLabel: 'Margins',
  bookReaderMarginNarrow: 'Narrow',
  bookReaderMarginMedium: 'Medium',
  bookReaderMarginWide: 'Wide',
  bookReaderJustify: 'Justified text',
  bookReaderModeLabel: 'Reading mode',
  bookReaderModeInfinite: 'Infinite',
  bookReaderModePaged: 'Paged',
  searchPlaceholder: 'Search by name',
  searchClear: 'Clear search',
  searchLoading: 'Loading series...',
  searchError: 'Could not load the series',
  searchRetry: 'Try again',
  searchNoResults: 'No series found',
  searchResultCount: '{0} results',
  searchResultCountOne: '1 result',
  searchEmptyHint: 'Type to search your library',
  searchRecentTitle: 'Recently opened',
  searchRecentDelete: 'Remove from history',
  searchRecentDeleteConfirm: 'Remove this series from the history?',
  searchDeleteCancel: 'Cancel',
  searchDeleteConfirm: 'Remove',

  splashVersion: 'v',
  splashUpdateButton: 'Apply update',

  otaRequiredTitle: 'Mandatory update',
  otaRequiredBody: 'This version is no longer supported. To continue using the app, view the release notes and install the update.',
  otaHighlyRecTitle: 'Highly recommended update',
  otaRecommendedTitle: 'New version available',
  otaAdvisoryBody: 'A new version of the app is available. We recommend updating for the best experience.',
  otaDismiss: 'Not now',
  otaViewNotes: 'View release notes',

  versionBackend: 'backend',
  versionApp: 'app',
  versionFrontend: 'frontend',

  setupTitle: 'Welcome',
  setupSubtitle: 'Set up your Kavita server to get started.',
  setupGoToLibrary: 'Go to Library',
  setupTestConnection: 'Test connection',
  setupForceReselect: 'Force reselect',
  setupTesting: 'Testing...',
  setupConnectionOk: 'Connection OK',
  setupAuthenticate: 'Authenticate',
  setupAuthenticating: 'Authenticating...',
  setupAuthOk: 'Authenticated',
  setupApiKeyLabel: 'Kavita API Key',
  setupBffSection: 'BFF Server (optional)',
  setupBffTestConnection: 'Test BFF',
  setupBffConnectionOk: 'BFF OK',

  exitTitle: 'Exit app',
  exitMessage: 'Do you want to close the app?',
  exitCancel: 'Cancel',
  exitConfirm: 'Exit',

  seriesDetailLoading: 'Loading...',
  seriesDetailError: 'Failed to load series',
  seriesDetailRetry: 'Try again',
  seriesDetailStartReading: 'Start reading',
  seriesDetailContinueReading: 'Continue reading - {0}',
  seriesDetailRereadFromStart: 'Reread',
  seriesDetailChaptersRead: '{0}/{1} read',
  seriesDetailEnrichmentPending: 'Fetching additional data...',
  seriesDetailEnrichmentUpdated: 'Additional data updated',
  seriesDetailEnrichmentUpdateFailed: 'Could not update the additional data',
  seriesDetailEnrichmentFailed: 'Incomplete data — enrichment server unavailable',
  seriesDetailAuthorLabel: 'Author',
  seriesDetailAlternativeTitlesLabel: 'Other titles',
  seriesDetailAbandonedLabel: 'Dropped by the source',
  seriesDetailDescriptionReadMore: 'Read more',
  seriesDetailDescriptionReadLess: 'Read less',
  seriesDetailChapterNumberLabel: 'Chapter {0}',
  seriesDetailChapterUntitled: 'Untitled',
  seriesDetailSortAscending: 'Ascending',
  seriesDetailSortDescending: 'Descending',
  seriesDetailSortAutoFixed: 'Auto (ch. {0})',
  seriesDetailSortAutoProgress: 'Auto ({0}%)',
  seriesDetailSelectionMarkRead: 'Mark as read',
  seriesDetailSelectionMarkUnread: 'Mark as unread',
  seriesDetailSelectionSelectAll: 'Select all',
  seriesDetailSelectionInvert: 'Invert selection',
  seriesDetailSelectionRange: 'Select range',
  seriesDetailRangeTitle: 'Select chapter range',
  seriesDetailRangeFromLabel: 'From',
  seriesDetailRangeToLabel: 'To',
  seriesDetailRangeCancel: 'Cancel',
  seriesDetailRangeApply: 'Select',
  seriesDetailRangeInvalid: 'Enter a valid range',
  seriesDetailBackLabel: 'Back',
  seriesDetailFollowLabel: 'Follow series',
  seriesDetailUnfollowLabel: 'Unfollow series',
  seriesDetailChapterMenuLabel: 'Chapter list options',
  seriesDetailChapterMenuSort: 'Sort order',
  seriesDetailChapterMenuRange: 'Select range',
  seriesDetailSortConfigTitle: 'Chapter sort order',
  seriesDetailSortConfigFixedThresholdLabel: 'Threshold chapter',
  seriesDetailSortConfigFixedThresholdHint: 'Descending from this chapter onward',
  seriesDetailSortConfigProgressPercentLabel: 'Progress percentage',
  seriesDetailSortConfigProgressPercentHint: 'Descending from this percentage onward (0–100)',
  seriesDetailSortConfigCancel: 'Cancel',
  seriesDetailSortConfigSave: 'Save',
  seriesDetailSortConfigReset: 'Use app default',
  seriesDetailSortConfigOverrideNote: 'This series has its own sort order, different from the app default.',

  readerLoading: 'Loading...',
  readerError: 'Failed to load chapter',
  readerRetry: 'Retry',
  readerPageError: 'Failed to load page',
  readerPageErrorWithCode: 'Failed to load page ({code})',
  debugPageBudgetTitle: 'Maximum page size',
  debugPageBudgetHint:
    'Tall pages are scaled down to fit this size. Smaller = smoother, larger = sharper. Applies to pages loaded after the change.',
  debugLogTitle: 'Diagnostics log',
  debugLogHint:
    'A local file with errors, freezes and why the app closed. It never leaves the device: read it with the command below, or export it.',
  debugLogSize: 'Size',
  debugLogAdb: 'Read from a computer',
  debugLogExport: 'Export',
  debugLogClear: 'Clear',
  debugLogRefresh: 'Refresh',
  readerOffline: 'No connection',
  readerEndOfChapter: 'End of chapter {0}',
  readerEndOfChapterPrefix: 'End of chapter',
  readerNextChapterLabel: 'Next:',
  readerNoNextChapter: 'No next chapter',
  readerNoPrevChapter: 'No previous chapter',
  readerChapterIndicator: 'Ch. {0} of {1}',
  readerChapterPickerButtonLabel: 'Select chapter',
  readerChapterPickerTitle: 'Chapters',
  readerSettingsButtonLabel: 'Reading settings',
  readerPrevChapterButtonLabel: 'Previous chapter',
  readerOpenSeriesLabel: 'Go to the series',
  readerNextChapterButtonLabel: 'Next chapter',
  readerSettingsCloseButtonLabel: 'Close',
  readerProgressColorLabel: 'Reading progress colour',
  readerProgressColorDefault: 'Theme default',
  readerProgressPositionLabel: 'Progress indicator position',
  readerProgressPositionLeft: 'Left',
  readerProgressPositionRight: 'Right',
  readerProgressPositionTop: 'Top',
  readerProgressPositionBottom: 'Bottom',

  errorApiKeyEmpty: 'API key cannot be empty',
  errorDbVersionMismatch: 'Database version mismatch',
  errorDbNotOpen: 'Database is not open',

  dateJustNow: 'just now',
  dateMinutesAgo: '{0} minute(s) ago',
  dateHoursAgo: '{0} hour(s) ago',
  dateDaysAgo: '{0} day(s) ago',

  libraryUpdatedAgo: 'Updated {0}',
  libraryUpdatedAt: 'Updated at {0}',
  libraryOfflineStale: '(Offline) Updated {0}',
  libraryOfflineNoDate: 'Offline — showing saved data',

  serverSectionTitle: '{0} servers',
  serverMetadataSectionFallback: 'Metadata servers',
  serverAddServer: '+ Add server',
  serverAddMetadataServer: '+ Add metadata server',
  serverUrlsLabel: 'URLs',
  serverAddUrl: '+ Add URL',
  serverModalNewTitle: 'New server',
  serverModalEditTitle: 'Edit server',
  serverModalProviderLabel: 'Provider',
  serverModalNameLabel: 'Name',
  serverModalNamePlaceholder: 'Home server',
  urlModalNewTitle: 'New URL',
  urlModalEditTitle: 'Edit URL',
  urlModalUrlLabel: 'URL',
  urlModalUrlPlaceholder: 'http://192.168.1.100:5000',
  urlModalTestConnection: 'Test connection',
  urlModalTesting: 'Testing…',
  urlModalTestOk: 'connected',
  urlModalTestFail: 'failed',
  urlModalServerLabel: 'Server',
  urlModalAssociateToUrl: 'Associate with a server URL',
  urlModalNoUrlsInServer: 'No URLs in that server',
  urlModalPickServer: 'Select a server',
  urlModalPickUrl: 'Select a URL',
  selectPlaceholder: 'Select…',
  serverConnErrorNoUrl: 'No URL responded. Check the addresses and that the server is up.',
  serverConnErrorNoActiveGroup: 'No active server.',
  serverConnErrorGeneric: 'Could not connect.',
  serverErrorNoProvider: 'No server provider available',
  serverErrorNoMetadataProvider: 'No metadata server provider available',
  serverErrorNoServerToEdit: 'No server to edit',
  serverErrorNoMetadataServerToEdit: 'No metadata server to edit',
  serverErrorNoServer: 'No server',
  serverErrorNoMetadataServer: 'No metadata server',
  serverErrorUrlInvalid: 'Invalid URL (use http:// or https://)',

  notificationsSectionTitle: 'Notifications',
  notificationsChannelRowLabel: 'System notifications',
  notificationsChannelStateOn: 'On',
  notificationsChannelStateOff: 'Off',
  notificationsChannelOpenSettings: 'Open settings',
  notificationsScopeAll: 'Notify for all series',
  notificationsScopeFollowedOnly: 'Notify for followed series only',
  notificationsGroupAcrossSeries: 'Group notifications across series',
  notificationsCollapseSerialChaptersNotification: 'Collapse nearby chapters of the same serial in history',
  notificationsRetentionLabel: 'Keep history for',
  notificationsRetentionDaysSuffix: 'days',
  notificationsRetentionDecreaseLabel: 'Decrease retention days',
  notificationsRetentionIncreaseLabel: 'Increase retention days',
  notificationsGroupsTitle: 'Notification servers',
  notificationsAddGroup: '+ Add notification server',
  notificationsGroupModalNewTitle: 'New notification server',
  notificationsGroupModalEditTitle: 'Edit notification server',
  notificationsGroupModalNameLabel: 'Name',
  notificationsGroupModalNamePlaceholder: 'Home',
  notificationsGroupModalTopicLabel: 'Topic',
  notificationsGroupModalTopicPlaceholder: 'new-chapters',
  notificationsUrlModalNewTitle: 'New URL',
  notificationsUrlModalEditTitle: 'Edit URL',
  notificationsUrlModalUrlLabel: 'URL',
  notificationsUrlModalUrlPlaceholder: 'https://ntfy.sh',
  notificationsErrorNoGroup: 'No notification server',
  notificationsErrorGroupNameRequired: 'Name is required',
  notificationsErrorTopicRequired: 'Topic is required',
  notificationsErrorUrlInvalid: 'Invalid URL (use http:// or https://)',
  notificationsServiceStatusStopped: 'Stopped',
  notificationsServiceStatusConnecting: 'Connecting…',
  notificationsServiceStatusConnected: 'Connected',
  notificationsServiceStatusDisconnected: 'Disconnected',

  notificationsHistoryTitle: 'Notifications',
  notificationsHistoryEmpty: 'No notifications yet',
  notificationsHistoryMarkAllRead: 'Mark all as read',
  notificationsHistoryDelete: 'Delete',
  notificationsHistoryBodyBatch: '{0} new chapters available',
  notificationsHistoryBodyNumbered: 'Chapter {0} available',
  notificationsHistoryBodyUnnumbered: 'New chapter available',
  notificationsHistoryTotalCount: '{0}/{1} notifications',
  notificationsHistoryTotalCountAllRead: '{0} notifications',
  notificationToastSummary: '{0} new notifications',
  notificationToastOpen: 'See what arrived',
  notificationToastClose: 'Close notifications',
  notificationsHistoryInfo: 'More information',
  notificationsHistorySelectionSelectAll: 'Select all',
  notificationsHistorySelectionMarkRead: 'Mark as read',
  notificationsHistorySelectionMarkUnread: 'Mark as unread',
  notificationsHistorySelectionDelete: 'Delete',
  notificationsHistoryDeleteConfirmTitleOne: 'Delete this notification?',
  notificationsHistoryDeleteConfirmTitleMany: 'Delete {0} notifications?',
  notificationsHistoryDeleteConfirmCancel: 'Cancel',
  notificationsHistoryDeleteConfirmConfirm: 'Delete',
  notificationsHistoryDetailTitle: 'Notification details',
  notificationsHistoryDetailChaptersTitle: 'Included chapters',
  notificationsHistoryDetailGoToSeries: 'Go to series',
  notificationsHistoryDetailMarkUnread: 'Mark as unread',
  notificationsHistoryDetailDelete: 'Delete',
  notificationsHistoryDetailClose: 'Close',
};

export const allStrings: Record<Language, Strings> = { 'pt-BR': ptBR, en };

export function getStrings(language: string): Strings {
  return allStrings[(language as Language)] ?? ptBR;
}
