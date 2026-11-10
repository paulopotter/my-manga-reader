# Changelog

Todas as mudanças notáveis deste projeto serão documentadas aqui.
All notable changes to this project will be documented here.

O formato segue / The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

App releases use datetime versioning (`YYYY.MM.DD.HHmm`).
Kotlin and RN bundle versions follow Semantic Versioning independently.

## [Unreleased]

### Frontend
- fix: o cabeçalho do leitor (obra e título do capítulo) não fica mais atrás da câmera/notch quando o modo imersivo está ligado.

## [[2026.11.01.1721](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.11.01.1721)] - 2026-11-01

Agora ficou mais fácil navegar por capítulos longos, o leitor exibe o progresso correto de capítulos e você pode esconder obras da tela inicial. / Now it is easier to navigate through long chapters, the reader displays the correct chapter progress, and you can hide titles from the home screen.


### **Backend** - `1.10.0`

**[pt-BR]**
- Imagens muito altas no modo webnovel que falhavam ao carregar agora exibem o botão de recarregar no início, no meio e no fim da imagem.

**[en]**
- Very tall webnovel images that failed to load now display the reload button at the top, middle, and bottom of the image.

### **Frontend** - `1.11.0`

**[pt-BR]**
- As telas de erro do leitor, de imagens e de livros voltaram a exibir textos legíveis em todos os temas, com o botão de voltar posicionado no topo.
- Capítulos abertos por notificações não travam mais no fim, garantindo que a lista de capítulos seja atualizada e a navegação entre eles volte a funcionar.
- A barra lateral do leitor se transforma em um controle deslizante com prévia flutuante da página sob o dedo quando há muitas páginas.
- O cabeçalho do leitor passou a exibir o capítulo atual e o total de capítulos da obra em vez das informações de página.
- Manter pressionado um card na seção de leitura contínua oculta a obra da página inicial até que você volte a ler.

**[en]**
- The reader, image, and book error screens once again display legible text across all themes, with the back button positioned at the top.
- Chapters opened via notifications no longer freeze at the end, ensuring the chapter list updates and navigation between them works properly.
- The reader sidebar transforms into a slider with a floating page preview under your finger when dealing with many pages.
- The reader header now displays the current chapter and total chapter count of the series instead of page information.
- Long-pressing a card in the continue reading section hides the title from the home page until you read it again.

## [[2026.10.26.1331](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.10.26.1331)] - 2026-10-26

Maior estabilidade nas notificações em segundo plano e melhorias na navegação e visualização de avisos dentro do app. / Better background notification stability and improvements to navigation and in-app alert viewing.


### **Backend** - `1.9.0`

**[pt-BR]**
- O serviço de notificações do celular foi aprimorado para não fechar mais o aplicativo inesperadamente quando o sistema interrompe tarefas em segundo plano, voltando a funcionar automaticamente ao reabrir o leitor.

**[en]**
- The mobile notification service was improved to prevent the app from crashing unexpectedly when the system interrupts background tasks, resuming operation automatically once the reader is reopened.

### **Frontend** - `1.10.0`

**[pt-BR]**
- Adicionado um aviso visual discreto no topo da tela quando novas notificações chegam com o aplicativo aberto, permitindo tocar para ver a lista agrupada por série com capas e respeito ao filtro de conteúdo sensível.
- O botão de voltar na tela de detalhes da série, quando acessada direto pelo leitor, agora retorna corretamente para o ponto de origem em vez de reabrir o capítulo.
- Ativar ou desativar o modo de restrição de conteúdo sensível agora redireciona automaticamente para a tela inicial para atualizar a exibição.

**[en]**
- Added a subtle top banner alert when new notifications arrive while the app is open, letting you tap to view a grouped list by series with cover art and content filter respect.
- The back button on the series details screen, when opened directly from the reader, now correctly returns to the starting point instead of reopening the chapter.
- Toggling the sensitive content restriction mode now automatically redirects you to the home screen to refresh the display.

## [[2026.10.18.1852](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.10.18.1852)] - 2026-10-18

Agora você pode ler livros em EPUB com sumário, organizar capítulos soltos de novels, navegar por obras gigantes sem travamentos e aproveitar um leitor de imagens mais fluido e personalizável. / Now you can read EPUB books with a table of contents, organize loose novel chapters, browse massive series without lag, and enjoy a smoother, more customizable image reader.


### **Backend** - `1.8.0`

**[pt-BR]**
- Leitura de livros em formato EPUB direto pelo servidor Kavita, exibindo informações, página em HTML e sumário completo.
- Capítulos soltos de novels do Kavita agora usam o número do volume e o título correto, mantendo a ordem exata.
- Séries com milhares de capítulos agora são salvas em pedaços no cache, evitando novas buscas pela rede a cada abertura.
- A lista de obras carrega instantaneamente de um cache e atualiza em segundo plano, sem apagar os capítulos já salvos e evitando buscas repetidas.
- Cada obra agora informa o formato em que seus arquivos são guardados, seja imagem, arquivo, EPUB ou PDF.
- Imagens AVIF agora respeitam o limite de memória e evitam o uso do chip gráfico, eliminando travamentos em capítulos compridos.
- Abrir o app em segundo plano com as notificações ativas não causa mais o encerramento inesperado do processo.

**[en]**
- Direct EPUB book reading via the Kavita server, displaying metadata, HTML pages, and a complete table of contents.
- Loose novel chapters from Kavita now properly incorporate the volume number and correct title in the exact order.
- Series containing thousands of chapters are now saved in segments within the cache, avoiding repeated network requests upon every opening.
- The library list loads instantly from a cached snapshot while updating silently in the background without clearing saved chapters or duplicating searches.
- Every title now reports the specific file format its contents are stored in, whether image, archive, EPUB, or PDF.
- AVIF images now strictly adhere to page memory limits and bypass hardware codecs, eliminating stuttering on extra-long vertical strips.
- Launching the application in the background while notification services are active no longer crashes the process.

### **Frontend** - `1.9.0`

**[pt-BR]**
- Zoom por página no leitor de imagens com duplo toque, pinça de 1x a 4x, arrasto livre e rolagem travada durante a ampliação.
- Novo leitor de novels em EPUB com opções de leitura infinita ou paginada, barra de progresso, temas, fontes, tamanhos, entrelinhas, margens e justificação centralizadas em Ajustes.
- O nome da obra no cabeçalho de ambos os leitores agora leva direto à página da obra, enquanto a seta de retorno continua direcionando à última tela.
- A tela inicial foi reorganizada em trilhos inteligentes para continuar leituras, acompanhar obras seguidas, retomar pendências e ver novidades sem repetir títulos ou exibir seções vazias.
- Selos informativos indicando se o conteúdo é Novel ou PDF aparecem nos cartões da tela inicial, da biblioteca e da busca.

**[en]**
- Page-level zoom for the image reader supporting double-taps, 1x to 4x pinch gestures, free panning, and locked scrolling while zoomed in.
- Brand new EPUB novel reader featuring infinite or paginated reading modes, a progress bar, custom themes, fonts, sizes, line spacing, margins, and text alignment managed under Settings.
- Tapping a title's name in the header of either reader now opens its detail page, whereas the back arrow reliably returns to the previous screen.
- The home screen was restructured into smart carousels to continue reading, track followed titles, resume unfinished items, and browse recent updates without duplicating cards or showing empty rows.
- Informative badges identifying Novel or PDF content are now displayed on the cards across the home screen, library, and search views.

## [[2026.10.17.0115](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.10.17.0115)] - 2026-10-17

O app agora conta com uma nova tela inicial com trilhos personalizados, salvamento instantâneo do progresso de leitura e otimizações na busca de metadados e categorias. / The app now features a new home screen with personalized rails, instant reading progress saving, and optimizations for metadata and category searches.


### **Backend** - `1.7.0`

**[pt-BR]**
- O plugin de metadados externos passou a utilizar a versão `/api/v1` da interface, otimizando o carregamento sem baixar todo o catálogo.
- A lista de obras agora exibe a data exata em que cada título foi adicionado à biblioteca.
- O servidor passou a fornecer diretamente a relação de categorias e seus respectivos mangás, sem expor códigos internos dos provedores.

**[en]**
- The external metadata plugin now utilizes the `/api/v1` interface version, optimizing loading without downloading the entire catalog.
- The manga list now displays the exact date each title was added to the library.
- The server now directly provides the relationship of categories and their respective mangas without exposing internal provider codes.

### **Frontend** - `1.8.0`

**[pt-BR]**
- Novo filtro de conteúdo sensível com opções para ocultar, exibir desfocado ou remover o desfoque, gerenciado por tags em Ajustes e aplicado em todas as abas.
- Nova tela principal no estilo painel com trilhos para continuar a leitura, novos capítulos, obras atualizadas, itens na fila, novidades e estatísticas de uso.
- Adicionada a opção em Ajustes para definir a tela inicial padrão entre a página principal e a aba de favoritos.
- O ponto onde você parou na leitura agora é atualizado imediatamente após a conclusão, sem aguardar a expiração do armazenamento temporário.
- Os indicadores de capítulos baixados passaram a exibir avisos de lacunas somente quando houver capítulos faltantes.

**[en]**
- New sensitive content filter with options to hide, blur, or unblur, managed via tags in Settings and applied across all browsing tabs.
- New dashboard-style main screen featuring rails for continuing reading, recent chapters, updated titles, queued items, new arrivals, and usage statistics.
- Added an option in Settings to choose the default startup screen between the main page and the favorites tab.
- Your reading progress point is now updated immediately upon completion, bypassing any temporary storage expiration delays.
- Downloaded chapter labels now display missing gap warnings only when there are actually skipped chapters.

## [[2026.10.13.2105](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.10.13.2105)] - 2026-10-13

Maior estabilidade ao abrir páginas longas, carregamento de imagens mais rápido e correções importantes de conexão e cache. / Greater stability when opening long pages, faster image loading, and important connection and cache fixes.


### **Backend** - `1.6.0`

**[pt-BR]**
- O aplicativo não fecha mais ao abrir obras com páginas muito altas e a rolagem ficou muito mais fluida.
- O carregamento de páginas já vistas foi otimizado e o espaço temporário é limpo automaticamente ao iniciar.
- Trocar entre rede local e endereço externo não baixa as imagens de novo e esconde dados sensíveis.
- O sistema de conexão agora recupera o endereço local mais rápido e atualiza o servidor ativo corretamente.
- A tela de detalhes da obra não exibe mais capítulos desatualizados e o aplicativo lida melhor com falhas.

**[en]**
- The app no longer crashes when opening titles with very tall pages and scrolling has become much smoother.
- Loading previously viewed pages was optimized and temporary storage is automatically cleared upon startup.
- Switching between local network and external address does not redownload images and hides sensitive data.
- The connection system now recovers the local address faster and updates the active server correctly.
- The title details screen no longer displays outdated chapters and the application handles failures better.

### **Frontend** - `1.7.0`

**[pt-BR]**
- Sem alterações nesta versão

**[en]**
- No changes in this version

## [[2026.09.25.0053](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.25.0053)] - 2026-09-25

Nova seleção de capítulos em massa, ajustes rápidos no leitor e mais opções visuais para a sua biblioteca. / New bulk chapter selection, quick reader adjustments, and more visual options for your library.


### **Backend** - `1.5.0`

**[pt-BR]**
- Sem alterações nesta versão

**[en]**
- No changes in this version

### **Frontend** - `1.6.0`

**[pt-BR]**
- Seleção de intervalo de capítulos na tela da série para marcar vários como lidos de uma vez.
- Seleção rápida de capítulo e ajustes de leitura direto no overlay do leitor, com cabeçalho mais legível.
- Cor e posição da barra de progresso de leitura agora são configuráveis, com opção de restaurar o padrão do tema.
- Filtro por status de leitura (não lido, lendo, lido) na Biblioteca e em Seguindo.
- Todo ícone tocável do app agora mostra seu nome como dica ao ser pressionado e segurado.

**[en]**
- Chapter range selection on the series screen to mark multiple chapters as read at once.
- Quick chapter selection and reading adjustments directly within the reader overlay, featuring a more readable header.
- Color and position of the reading progress bar are now customizable, with an option to restore the default theme settings.
- Filter by reading status (unread, reading, read) in the Library and Following tabs.
- Every tappable icon in the app now displays its name as a tooltip when pressed and held.

## [[2026.09.22.0136](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.22.0136)] - 2026-09-22

Informações detalhadas sobre as obras carregam mais rápido com dados salvos no celular e a tela de leitura ficou mais fluida. / Detailed manga information loads faster with data saved on your phone and the reading screen became much smoother.


### **Backend** - `1.5.0`

**[pt-BR]**
- As informações dos mangás agora são encontradas com precisão exata pelo código da obra e não mais por adivinhação pelo título.
- O aplicativo guarda as informações dos mangás no celular para abrir tudo instantaneamente enquanto atualiza os dados em segundo plano.
- O sistema de consultas foi limitado para evitar excesso de pedidos simultâneos que antes conseguiam derrubar o servidor.
- A lista de capítulos carrega de forma muito mais rápida ao executar verificações simultâneas em vez de uma por uma.
- O carregamento incompleto que travava os dados antigos foi corrigido para que as informações atualizadas apareçam sem precisar atualizar a tela manualmente.
- Os novos detalhes das obras agora também aparecem corretamente na listagem geral do sistema.

**[en]**
- Manga details are now found with exact precision using the work's ID rather than guessing by title.
- The app stores manga information locally on your device to open everything instantly while refreshing data in the background.
- Request limits were introduced to prevent a surge of simultaneous queries from crashing the server.
- The chapter list loads much faster by running checks concurrently instead of sequentially.
- Incomplete loading that used to trap old data has been fixed so updated information appears without requiring a manual refresh.
- New metadata fields now correctly appear in the system's general listing as well.

### **Frontend** - `1.5.0`

**[pt-BR]**
- A tela do mangá exibe o autor e outros títulos vindos do servidor, avisando o status do carregamento em tempo real.
- As configurações avançadas permitem escolher qual servidor responde cada campo, aceitando regras gerais e exceções personalizadas.
- A rolagem da lista de capítulos foi otimizada para aguentar séries com centenas de episódios sem travamentos.
- Salvar a fonte de dados favorita não altera mais a sua preferência de ordenação de capítulos que antes voltava para o modo crescente.
- Os avisos de erro, alerta e sucesso ganharam cores distintas em todos os temas visuais do aplicativo.
- A barra de progresso do leitor no tema verde-azulado passou a usar a cor ciano correta em vez de âmbar.

**[en]**
- The manga screen displays authors and alternative titles fetched from the server, indicating loading status in real time.
- Advanced settings allow you to choose which server answers each field, supporting general rules and customized exceptions.
- Chapter list scrolling was optimized to handle series with hundreds of episodes without lagging.
- Saving your preferred data source no longer resets your chapter sorting preference back to ascending order.
- Error, warning, and success notices now feature distinct colors across all visual themes in the app.
- The reader progress bar in the teal theme now displays the correct cyan color instead of amber.

## [[2026.09.19.1953](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.19.1953)] - 2026-09-19

Avisos do leitor adaptados ao idioma e tema do app, além de doze opções de cores escuras para a interface. / Reader warnings adapted to the app language and theme, plus twelve dark color options for the interface.


### **Backend** - `1.4.0`

**[pt-BR]**
- Os avisos de erro no leitor agora acompanham o idioma e as cores do app.
- O leitor recebeu indicadores de carregamento e áreas de toque aprimoradas.
- O ícone do aplicativo, a tela de abertura e as notificações adotaram a nova identidade visual.

**[en]**
- Reader error notices now match the app language and color scheme.
- The reader received loading indicators and improved touch areas.
- The app icon, launch screen, and notifications adopted the new visual identity.

### **Frontend** - `1.4.0`

**[pt-BR]**
- Adicionados doze temas escuros com troca instantânea, incluindo quatro opções em preto puro para telas OLED.
- A preferência de tema é lembrada ao reabrir o app, e o seletor exibe uma prévia visual antes da aplicação.
- O histórico de leitura exibe o progresso correto de cada obra em vez de barras zeradas.
- As setas de navegação foram realinhadas com precisão e os avisos de conexão ganharam novos ícones temáticos.
- Todas as telas ganharam margens padronizadas, mantendo o leitor em tela cheia.

**[en]**
- Added twelve dark themes with instant switching, including four pure black options for OLED screens.
- Your theme choice is remembered upon reopening the app, and the selector displays a visual preview before application.
- Reading history now displays the correct progress for each title instead of empty bars.
- Navigation arrows were precisely realigned and connection warnings gained new themed icons.
- All screens received standardized margins while keeping the reader in full screen.

## [[2026.09.18.2140](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.18.2140)] - 2026-09-18

Agora você pode buscar mangás ignorando acentos, gerenciar seu histórico de pesquisas e ver o status de favorito atualizado em tempo real. / Now you can search for mangas ignoring accents, manage your search history, and see real-time updated favorite statuses.


### **Backend** - `1.3.0`

**[pt-BR]**
- Sem alterações nesta versão

**[en]**
- No changes in this version

### **Frontend** - `1.3.0`

**[pt-BR]**
- Nova tela de busca inteligente que encontra séries pelo nome ignorando acentos e maiúsculas, exibindo a contagem de resultados e um histórico de pesquisas removível com confirmação
- O cartão visual das séries foi movido para um componente compartilhado padronizado com suporte a listas aninhadas, simplificando a montagem das telas
- A pasta com ferramentas de séries foi renomeada para alinhar o nome com o vocabulário utilizado pela camada de dados do sistema
- O ícone de favorito agora reflete o estado atual corretamente em qualquer tela, sem ficar preso ao valor antigo de quando a lista foi carregada

**[en]**
- New intelligent search screen that finds series by name ignoring accents and uppercase letters, displaying the result count and a removable search history with confirmation
- The visual series card was moved to a standardized shared component supporting nested lists, simplifying screen assembly
- The series tools folder was renamed to align with the vocabulary used by the system data layer
- The favorite icon now correctly reflects the current state on any screen without getting stuck on the old value from when the list was loaded

## [[2026.09.17.1123](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.17.1123)] - 2026-09-17

Agora você pode gerenciar suas notificações em massa com mais facilidade e sua leitura é atualizada na hora em todas as telas. / Now you can easily manage your notifications in bulk and your reading progress updates instantly across all screens.


### **Backend** - `1.3.0`

**[pt-BR]**
- Agora você pode marcar uma notificação como não lida diretamente pelo histórico
- O progresso de leitura dos capítulos é atualizado instantaneamente em todas as telas ao marcá-los como lidos ou não lidos

**[en]**
- You can now mark a notification as unread directly from your history
- Chapter reading progress updates instantly across all screens when marked as read or unread

### **Frontend** - `1.2.0`

**[pt-BR]**
- A tela de notificações agora permite selecionar vários itens de uma vez para marcar como lidos, não lidos ou apagar em massa
- O app sempre pede uma confirmação antes de excluir notificações, seja de forma individual ou em lote
- Um novo pop-up de detalhes mostra os capítulos do grupo, o horário exato e a imagem da série ao tocar em uma notificação
- Os cards de notificação exibem a imagem da série e o cabeçalho agora mostra a contagem total de avisos
- A descrição das séries foi limitada a seis linhas com um botão prático para expandir ou recolher o texto
- A tela de detalhes da série não perde mais o status de leitura do capítulo ao voltar do leitor
- O card da aba Seguindo atualiza o progresso de leitura imediatamente, sem precisar recarregar a lista
- Pequenos saltos visuais foram eliminados ao carregar imagens ou entrar no modo de seleção nas telas de notificações e biblioteca
- Os ícones dos menus de configuração, notificações e leitor foram padronizados com o restante do aplicativo

**[en]**
- The notifications screen now lets you select multiple items at once to mark as read, unread, or delete in bulk
- The app always asks for confirmation before deleting notifications, whether done individually or in a batch
- A new details pop-up shows group chapters, the exact timestamp, and the series cover image when tapping a notification
- Notification cards display the series artwork and the header now shows the total count of alerts
- Series descriptions are now limited to six lines with a handy button to expand or collapse the text
- The series details screen no longer loses the chapter's read status when returning from the reader
- The Following tab card updates reading progress immediately without needing to reload the list
- Minor visual jumps were eliminated when loading images or entering selection mode on the notification and library screens
- Icons in the settings, notifications, and reader menus were unified to match the rest of the app

## [[2026.09.14.1202](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.14.1202)] - 2026-09-14

O app agora verifica as releases oficiais automaticamente quando o endereço configurado falha ou está desatualizado, garantindo que versões recentes cheguem aos aparelhos de desenvolvimento. / The app now automatically checks official releases when the configured address fails or lacks updates, ensuring recent versions reach development devices.


### **Backend** - `1.2.0`

**[pt-BR]**
- O app agora busca atualizações nas releases oficiais caso o servidor configurado falhe ou não traga novidades, permitindo que builds de teste recebam versões novas desde que sejam mais recentes que a instalada.

**[en]**
- The app now fetches updates from official releases if the configured server fails or returns nothing, allowing test builds to receive new versions as long as they are newer than the currently installed one.

### **Frontend** - `1.1.0`

**[pt-BR]**
- Sem alterações nesta versão

**[en]**
- No changes in this version

## [[2026.09.14.1114](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.14.1114)] - 2026-09-14

Agora o aplicativo avisa sobre novos capítulos em tempo real, abre links externos direto no mangá correto e consome muito menos memória. / Now the app notifies you about new chapters in real-time, opens external links directly to the right manga, and consumes much less memory.


### **Backend** - `1.1.0`

**[pt-BR]**
- Serviço de notificações em segundo plano com conexão persistente, filtro pela sua lista de mangás seguidos e avisos nativos.
- Suporte a links diretos para abrir séries e capítulos do servidor diretamente no aplicativo através de URLs compatíveis.
- O histórico de notificações agora organiza um capítulo por linha com controle individual de leitura e destino ao tocar.
- Notificações são marcadas automaticamente como lidas quando você consome o conteúdo por qualquer caminho no aplicativo.
- Reconexão automática inteligente do serviço de notificações com tempo de espera progressivo e pausa quando sem internet.
- O serviço de avisos volta a conectar ao iniciar o aplicativo, evitando que dispositivos já configurados ficassem mudos.
- A sessão com o servidor se reconecta sozinha em chamadas de conteúdo caso tenha iniciado com a internet offline.
- Limite rígido no uso de memória para páginas de mangá, reduzindo o consumo de RAM de cerca de 660 megabytes para 249 megabytes.

**[en]**
- Background notification service with a persistent connection, filtering based on your followed manga list, and native alerts.
- Support for deep links to open server series and chapters directly inside the app using compatible URLs.
- The notification history now organizes one chapter per line with individual read status and tap destinations.
- Notifications are automatically marked as read whenever you consume the content through any path in the app.
- Smart automatic reconnection for the notification service with progressive wait times and a pause when offline.
- The alert service reconnects upon app launch, preventing already configured devices from remaining silent.
- The server session reconnects automatically during content calls if it started up while offline.
- Strict memory limits for manga pages, reducing RAM usage from around 660 megabytes down to 249 megabytes.

### **Frontend** - `1.1.0`

**[pt-BR]**
- Nova aba dedicada ao histórico de notificações com controle de leitura, contadores e opção de exclusão.
- Nova tela de configurações de notificações com gerenciar grupos, indicador de status ao vivo, teste e retenção ajustável.
- Agrupamento visual opcional para capítulos recentes da mesma série no histórico com janela de tempo personalizada.
- Abrir o aplicativo por links externos leva direto ao conteúdo desejado sem criar telas intermediárias confusas.
- Servidor indisponível na inicialização não força mais a tela de configuração inicial, exigindo apenas credenciais inválidas.
- Marcar vários capítulos como lidos simultaneamente não causa mais congelamentos na interface visual.

**[en]**
- New dedicated notification history tab featuring read tracking, counters, and a deletion option.
- New notification settings screen with group management, live status indicator, connection testing, and adjustable retention.
- Optional visual grouping for close chapters of the same series in history with a customizable time window.
- Opening the app via external links leads straight to the desired content without creating confusing intermediate screens.
- Server unavailability at startup no longer forces you into the initial setup screen, reserving that for invalid credentials.
- Marking multiple chapters as read simultaneously no longer causes freezes in the visual interface.

## [[2026.09.04.2000](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.09.04.2000)] - 2026-09-04

Reformulação ampla da arquitetura do app, trazendo uma nova tela de leitura, gestão de múltiplos servidores e diversas correções de sincronização e performance. / Broad rework of the app's architecture, bringing a new reading screen, multi-server management, and several sync and performance fixes.

### **Backend** - `1.0.0`

**[pt-BR]**
- A leitura de dados agora funciona de forma mais inteligente: o app guarda informações recentes localmente e só busca no servidor quando necessário, deixando tudo mais rápido.
- O login agora renova a sessão sozinho quando ela expira, sem precisar entrar de novo.
- O carregamento da sua biblioteca ficou bem mais rápido — o que antes levava cerca de 11,6 segundos por série agora é praticamente instantâneo.
- Preferências antigas de tela foram migradas para o novo sistema de armazenamento, sem perda de configuração.
- Corrigida a ordenação da biblioteca, que travava com certas datas vindas do servidor.
- Corrigido um erro que podia travar o app durante uma atualização do banco de dados local.

**[en]**
- Data loading is now smarter: the app keeps recent information stored locally and only reaches out to the server when needed, making everything faster.
- Login now silently renews your session when it expires, without needing to sign in again.
- Loading your library got much faster — what used to take about 11.6 seconds per series is now nearly instant.
- Old screen preferences were migrated to the new storage system, with no configuration lost.
- Fixed library sorting, which used to get stuck on certain server dates.
- Fixed a bug that could freeze the app during a local database update.

### **Frontend** - `1.0.0`

**[pt-BR]**
- A forma como o app organiza e sincroniza os dados internamente foi reorganizada, deixando a base mais sólida para novas funcionalidades.
- A lista "Seguindo" e a Biblioteca agora se atualizam automaticamente entre si, sem precisar recarregar a tela.
- Nova tela de leitura, com navegação entre capítulos mais fluida e sem os travamentos da versão anterior.
- Nova tela de gerenciamento de servidores, com suporte a múltiplos endereços e verificação automática de conexão.
- Nova seção para configurar um servidor de metadados externo.
- Tela inicial reescrita para carregar mais rápido, sem depender de uma tela nativa separada.
- Três níveis de aviso de atualização: obrigatório (bloqueia o uso), recomendado (só avisa) e sugerido (baixa em segundo plano com botão para aplicar).
- O idioma do app agora acompanha automaticamente o idioma do celular.
- O modo de leitura imersiva agora ocupa a tela toda corretamente, incluindo a área do notch/câmera.
- A Biblioteca carrega mais leve e completa os detalhes conforme você rola a tela.
- Corrigido um travamento ao tocar no índice A-Z da Biblioteca.
- Corrigidas falhas de sincronização de progresso de leitura em alguns cenários (app em segundo plano, troca rápida de capítulo).
- Marcar vários capítulos como lidos de uma vez ficou mais rápido.
- Um capítulo agora é considerado lido a partir de 95% (antes 98%), refletindo melhor o uso real.

**[en]**
- The way the app organizes and syncs data internally was reorganized, giving new features a more solid foundation.
- The "Following" list and the Library now automatically update each other, without needing to reload the screen.
- New reading screen, with smoother chapter navigation and none of the previous version's freezes.
- New server management screen, with support for multiple addresses and automatic connection checking.
- New section to configure an external metadata server.
- Splash screen rewritten to load faster, no longer depending on a separate native screen.
- Three update warning levels: required (blocks usage), recommended (just a heads-up), and suggested (downloads in the background with a button to apply).
- The app's language now automatically follows your phone's language.
- Immersive reading mode now properly fills the whole screen, including the notch/camera area.
- The Library loads lighter and fills in details as you scroll.
- Fixed a crash when tapping the Library's A-Z index.
- Fixed reading progress sync failures in some scenarios (app in background, quick chapter switching).
- Marking multiple chapters as read at once is now faster.
- A chapter is now considered read starting at 95% (previously 98%), better reflecting actual usage.

## [[2026.08.20.0248](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.20.0248)] - 2026-08-20

Agora o app tem uma tela de leitura completa, com rolagem contínua entre páginas no estilo webtoon, navegação automática entre capítulos e acompanhamento de progresso. / The app now has a full reading screen, with continuous webtoon-style page scrolling, automatic chapter navigation, and progress tracking.

### **Backend** - `0.7.0`

**[pt-BR]**
- A leitura de capítulos agora usa um motor de rolagem nativo, corrigindo páginas muito altas (webtoons) que travavam ou ficavam pretas em alguns aparelhos.
- Adicionado suporte a decodificação de imagens no formato AVIF.
- O módulo nativo do leitor foi reorganizado internamente para facilitar futuras trocas de fonte de dados.
- Reduzido o consumo de log de diagnóstico durante a leitura, melhorando a fluidez da rolagem.
- Removida uma dependência não utilizada, reduzindo o tamanho do app.

**[en]**
- Chapter reading now uses a native scrolling engine, fixing very tall pages (webtoons) that used to freeze or render black on some devices.
- Added support for decoding AVIF images.
- The reader's native module was reorganized internally to make future data-source changes easier.
- Reduced diagnostic logging during reading, improving scroll smoothness.
- Removed an unused dependency, reducing app size.

### **Frontend** - `0.8.0`

**[pt-BR]**
- Nova tela de leitura de capítulos com rolagem contínua entre páginas, no estilo webtoon.
- A leitura avança automaticamente para o próximo capítulo ao chegar no fim, e recua para o anterior ao rolar para cima no início.
- Barra de progresso de leitura contínua, refletindo o quanto do capítulo já foi lido.
- Progresso de leitura salvo automaticamente, tanto localmente quanto no servidor.
- Capítulos são marcados como lidos automaticamente ao chegar ao fim, e desmarcados ao reler desde o início.
- Adicionado overlay de leitura com barra superior, navegação lateral entre páginas e indicador discreto de progresso, exibido ao tocar na tela.
- Adicionado aviso de conexão perdida durante a leitura.
- Adicionado botão de tentar novamente para páginas que falharem ao carregar.

**[en]**
- New chapter reading screen with continuous page scrolling, in webtoon style.
- Reading automatically advances to the next chapter when reaching the end, and goes back to the previous one when scrolling up at the start.
- Continuous reading progress bar, reflecting how much of the chapter has been read.
- Reading progress is saved automatically, both locally and on the server.
- Chapters are automatically marked as read when reaching the end, and unmarked when re-read from the start.
- Added a reading overlay with a top bar, side page navigation, and a discreet progress indicator, shown on tap.
- Added a lost-connection warning during reading.
- Added a retry button for pages that fail to load.

## [[2026.08.13.1211](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.13.1211)] - 2026-08-13

Agora o app permite que você organize melhor suas séries e capítulos, com novas opções de ordenação e marcação de leitura. / Now the app allows you to better organize your series and chapters, with new sorting options and reading marks.

### **Backend** - `0.6.0`

**[pt-BR]**
- Sua lista de capítulos agora pode ser ordenada de acordo com sua preferência, com opções de prioridade e marcação de lido ou não lido.
- A autenticação foi corrigida para evitar erros de acesso ao app.
- As rotas de sincronização de séries e capítulos foram corrigidas para evitar erros 404.
- O app agora exige autenticação válida antes de liberar o acesso.
- A ordenação automática por progresso de leitura foi adicionada para ajudar a encontrar o próximo capítulo.

**[en]**
- Your chapter list can now be sorted according to your preference, with priority options and read or unread marks.
- Authentication was fixed to prevent access errors.
- Series and chapter synchronization routes were fixed to prevent 404 errors.
- The app now requires valid authentication before granting access.
- Automatic sorting by reading progress was added to help find the next chapter.

### **Frontend** - `0.7.0`

**[pt-BR]**
- Um novo modal de configuração de ordenação de capítulos foi adicionado, acessível pela tela de série e por uma nova seção em Ajustes.
- O botão de voltar ao topo na lista de capítulos foi adicionado para melhorar a navegação.
- Os ícones da barra de navegação inferior foram substituídos por ícones vetoriais para melhorar a aparência.
- A lista "Seguindo" agora atualiza automaticamente quando uma série é seguida ou deixada de seguir em outra tela.
- A validação dos campos de configuração de ordenação foi adicionada para impedir valores inválidos.

**[en]**
- A new chapter sorting configuration modal was added, accessible from the series screen and a new section in Settings.
- A back to top button was added to the chapter list to improve navigation.
- The bottom navigation bar icons were replaced with vector icons to improve appearance.
- The "Following" list now updates automatically when a series is followed or unfollowed from another screen.
- Validation was added to the sorting configuration fields to prevent invalid values.

## [[2026.08.12.1048](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.12.1048)] - 2026-08-12

Agora o app exibe apenas as séries marcadas com estrela na aba "Seguindo" com layout de grid e ordenação independentes. / The app now displays only starred series in the "Following" tab with independent grid layout and sorting.

### **Backend** - `0.5.0`

**[pt-BR]**
- Sem alterações nesta versão

**[en]**
- No changes in this version

### **Frontend** - `0.6.0`

**[pt-BR]**
- A aba "Seguindo" exibe apenas as séries que você marcou com estrela, com um layout de grid e ordenação independentes da Biblioteca
- A aba "Seguindo" aparece automaticamente quando você está seguindo séries e some quando não há nenhuma série sendo seguida
- Ao marcar ou desmarcar uma série, a aba "Seguindo" é atualizada em tempo real sem precisar reiniciar o app

**[en]**
- The "Following" tab now displays only the series you've starred, with an independent grid layout and sorting
- The "Following" tab appears automatically when you're following series and disappears when you're not following any
- When you star or unstar a series, the "Following" tab updates in real-time without requiring a restart

## [[2026.08.12.1009](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.12.1009)] - 2026-08-12

Agora o app sincroniza suas séries e capítulos automaticamente na abertura e apresenta uma nova tela de splash com barra de progresso animada. / The app now synchronizes your series and chapters automatically on startup and features a new splash screen with an animated progress bar.

### **Backend** - `0.5.0`

**[pt-BR]**
- Sua biblioteca é sincronizada automaticamente quando você abre o app.
- O app agora armazena as políticas de atualização recebidas do manifesto e as expõe via uma ponte de eventos.
- As configurações do app são salvas mesmo após fechá-lo.
- O app não ignora mais a tela de splash após um stop forçado.
- O sistema de políticas de atualização foi implementado com diálogos temáticos.

**[en]**
- Your library is now synchronized automatically when you open the app.
- The app now stores the update policies received from the manifest and exposes them via an event bridge.
- The app's settings are saved even after closing it.
- The app no longer ignores the splash screen after a forced stop.
- The update policy system has been implemented with themed dialogs.

### **Frontend** - `0.5.0`

**[pt-BR]**
- Uma nova tela de splash com barra de progresso animada foi adicionada.
- O app apresenta uma navegação principal com abas inferiores para Biblioteca e Configurações.
- Telas placeholder foram adicionadas para as seções Following, Search, Reader, Notifications e SeriesDetail.
- Um componente de diálogo reutilizável foi criado com tema da app.
- A imagem da splash agora é exibida corretamente em dispositivos xxxhdpi.

**[en]**
- A new splash screen with an animated progress bar has been added.
- The app features a main navigation with bottom tabs for Library and Settings.
- Placeholder screens have been added for the Following, Search, Reader, Notifications, and SeriesDetail sections.
- A reusable dialog component has been created with the app's theme.
- The splash image is now displayed correctly on xxxhdpi devices.

## [[2026.08.11.1628](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.11.1628)] - 2026-08-11

Agora o app tem uma tela de biblioteca com listagem de séries e configurações de servidor. / The app now has a library screen with series listing and server settings.

### **Backend** - `0.4.0`

**[pt-BR]**
- Sua biblioteca é carregada automaticamente quando você abre o app.
- Você pode alternar entre modos de visualização e ordenação das séries.
- As séries podem ser marcadas como favoritas para acesso rápido.
- O app salva suas configurações de idioma e servidor.
- O cache de biblioteca é atualizado a cada 2 minutos.

**[en]**
- Your library is loaded automatically when you open the app.
- You can switch between viewing modes and series sorting.
- Series can be marked as favorites for quick access.
- The app saves your language and server settings.
- The library cache is updated every 2 minutes.

### **Frontend** - `0.4.0`

**[pt-BR]**
- Nova tela de biblioteca com lista de séries em duas colunas.
- Modo lista com metadados e estrela de favorito.
- Barra superior com contagem de séries e opções de visualização.
- Tela de configuração reestruturada com submenus.
- Opção de internacionalização com switch ao vivo.

**[en]**
- New library screen with a two-column series list.
- List mode with metadata and favorite star.
- Top bar with series count and viewing options.
- Restructured settings screen with submenus.
- Internationalization option with live switch.

## [[2026.08.11.0302](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.11.0302)] - 2026-08-11

Agora você pode desfrutar de melhorias no aplicativo My Manga Reader. / You can now enjoy improvements in the My Manga Reader app.

### **Backend** - `0.2.0`

**[pt-BR]**
- As atualizações do aplicativo agora são feitas de forma transparente, sem a necessidade de reinstalar o APK. 
- O aplicativo agora exibe as versões do backend, app e frontend na tela de splash.
- A integridade do bundle é validada via SHA-256 para garantir a segurança.
- O aplicativo agora faz rollback automático para o bundle anterior em caso de crash.
- Foram implementadas políticas de update para garantir a estabilidade do aplicativo.

**[en]**
- The app updates are now done transparently, without the need to reinstall the APK.
- The app now displays the versions of the backend, app, and frontend on the splash screen.
- The bundle integrity is validated via SHA-256 to ensure security.
- The app now automatically rolls back to the previous bundle in case of a crash.
- Update policies have been implemented to ensure app stability.

### **Frontend** - `0.2.0`

**[pt-BR]**
- A tela de configurações agora tem um fundo escuro e respeita a barra de status.
- As versões do backend, app e frontend são exibidas no rodapé da tela de configurações.
- Sem alterações adicionais nesta versão.

**[en]**
- The settings screen now has a dark background and respects the status bar.
- The versions of the backend, app, and frontend are displayed in the footer of the settings screen.
- No additional changes in this version.

## [[2026.08.11.0244](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.11.0244)] - 2026-08-11

Nova versão do My Manga Reader com melhorias e correções. / New version of My Manga Reader with improvements and fixes.

### **Backend** - `0.1.0`

**[pt-BR]**
- As atualizações agora são baixadas e instaladas automaticamente sem a necessidade de reinstalar o aplicativo.
- A tela de splash agora exibe as versões do backend, app e frontend.
- O aplicativo valida a integridade do bundle via SHA-256 para garantir a segurança.
- Em caso de crash, o aplicativo realiza um rollback automático para o bundle anterior.
- Foram implementadas políticas de update para garantir a estabilidade do aplicativo.

**[en]**
- Updates are now downloaded and installed automatically without the need to reinstall the app.
- The splash screen now displays the versions of the backend, app, and frontend.
- The app validates the integrity of the bundle via SHA-256 to ensure security.
- In case of a crash, the app automatically rolls back to the previous bundle.
- Update policies have been implemented to ensure app stability.

### **Frontend** - `0.1.0`

**[pt-BR]**
- A tela de configurações agora tem um fundo escuro e respeita a barra de status.
- As versões do backend, app e frontend são exibidas no rodapé da tela de configurações.
- Sem alterações adicionais nesta versão.

**[en]**
- The settings screen now has a dark background and respects the status bar.
- The versions of the backend, app, and frontend are displayed in the footer of the settings screen.
- No additional changes in this version.

## [[2026.08.10.2028](https://github.com/paulopotter/my-kavita-app-reader/releases/tag/2026.08.10.2028)] - 2026-08-10

Agora você pode desfrutar de melhorias no aplicativo My Manga Reader. / You can now enjoy improvements in the My Manga Reader app.

### **Backend** - `0.1.0`

**[pt-BR]**
- Suas configurações são salvas mesmo ao fechar o app
- O aplicativo pode selecionar automaticamente o melhor endereço para o seu servidor
- Agora você pode fazer login na sua biblioteca Kavita
- O aplicativo armazena suas preferências de UI de forma segura
- O aplicativo valida as configurações do servidor antes de conectá-lo

**[en]**
- Your settings are saved even when you close the app
- The app can automatically find the best address for your server
- You can now log in to your Kavita library
- The app stores your UI preferences securely
- The app validates server settings before connecting to it

### **Frontend** - `0.1.0`

**[pt-BR]**
- Nova tela de configurações com seções para servidor, login e preferências
- Interface visual conectada ao servidor nativo
- O aplicativo exibe uma tela de configuração intuitiva e fácil de usar
- Você pode facilmente navegar pelas diferentes seções da tela de configuração
- A tela de configuração é responsiva e se adapta a diferentes tamanhos de tela

**[en]**
- New settings screen with sections for server, login, and preferences
- Visually connected interface to the native server
- The app displays an intuitive and easy-to-use settings screen
- You can easily navigate through the different sections of the settings screen
- The settings screen is responsive and adapts to different screen sizes

