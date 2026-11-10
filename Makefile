.PHONY: setup build-android build-bundle build-all deploy log server help \
        ota-none ota-required ota-highly-recommended ota-recommended \
        coverage coverage-kotlin coverage-js \
        kill redeploy-log screenshots emulator emulator-stop check-screenshots pair \
        metrics metrics-report metrics-compare

APP_PACKAGE  := com.mymangareader
APP_ACTIVITY := .MainActivity

ANDROID_DIR  := android
FRONTEND_DIR := frontend

# Detect language from system locale (default: English)
LANG_IS_PT := $(shell echo "$$LANG $$LC_ALL $$LANGUAGE" | grep -qi 'pt_BR\|pt_PT\|portuguese' && echo 1 || echo 0)

ifeq ($(LANG_IS_PT),1)
MSG_COVERAGE             := Roda testes e gera relatório de cobertura (Kotlin + JS)
MSG_COVERAGE_KOTLIN      := Cobertura Kotlin — abre HTML em android/build/reports/kover/html/
MSG_COVERAGE_JS          := Cobertura JS/TS — abre HTML em frontend/coverage/lcov-report/
MSG_HELP                 := Mostra este menu de ajuda / Shows this help menu
MSG_SETUP                := Valida dependências, instala pacotes JS e git hooks
MSG_BUILD_ANDROID        := Gera APK de debug
MSG_BUILD_BUNDLE         := Gera bundle JS (React Native / Expo)
MSG_DEPLOY               := Instala o APK no dispositivo físico via USB
MSG_LOG                  := Exibe logs do app em tempo real via adb logcat
MSG_CHECK_SHOTS          := Confere se toda tela e todo tema têm screenshot na documentação
MSG_EMULATOR             := Sobe o emulador dos screenshots da documentação (HEADLESS=1 sem janela)
MSG_EMULATOR_STOP        := Desliga o emulador dos screenshots
MSG_PAIR                 := Pareia o celular com o adb por QR code (depuração sem fio)
MSG_SCREENSHOTS          := Tira os screenshots da documentação via adb (ONLY=nome, EMULATOR=1, THEMES=1 ou SERIAL=...)
MSG_METRICS              := Puxa métricas/logs do app do celular para metrics/<data>/ e mostra o relatório
MSG_METRICS_REPORT       := Relatório de uma coleta já salva (DIR=metrics/<data>, padrão: a mais nova)
MSG_METRICS_COMPARE      := Compara duas coletas (A=... B=..., padrão: as duas mais novas)
MSG_SERVER               := Levanta servidor OTA local na porta 8080 (adb reverse incluso)
MSG_KILL                 := Force-stop do app no dispositivo (sem desinstalar)
MSG_REDEPLOY_LOG         := Build + kill + deploy + log, salvando em /tmp/reader-log-vN.txt
MSG_NO_DEVICE            := ✗ Nenhum dispositivo conectado via adb
MSG_OTA_NONE             := OTA sem policy — só baixa e aplica o bundle
MSG_OTA_REQUIRED         := OTA policy=required — tela de bloqueio, app não abre
MSG_OTA_HIGH             := OTA policy=highly_recommended — popup bloqueante, app abre sem baixar
MSG_OTA_RECOMMENDED      := OTA policy=recommended — popup advisory, download prossegue
MSG_CHECKING_DEPS        := → Verificando dependências...
MSG_NO_NODE              := ✗ node não encontrado
MSG_NO_YARN              := ✗ yarn não encontrado
MSG_NO_JAVA              := ✗ java não encontrado
MSG_NO_ADB               := ✗ adb não encontrado (instale Android platform-tools)
MSG_CONVERT_ENV          := → Convertendo .env → local.properties...
MSG_INSTALL_HOOKS        := → Instalando git hooks...
MSG_INSTALL_JS           := → Instalando dependências JS...
MSG_READY                := ✓ Ambiente pronto
MSG_BUILD_ALL            := Gera APK de debug e bundle JS
MSG_BUILDING_APK         := → Compilando APK...
MSG_APK_DONE             := ✓ APK gerado
MSG_BUILDING_BNDL        := → Gerando bundle JS...
MSG_BUNDLE_DONE          := ✓ Bundle gerado
MSG_DEPLOYING            := → Instalando no dispositivo...
MSG_DEPLOY_DONE          := ✓ Instalado
else
MSG_COVERAGE             := Run tests and generate coverage report (Kotlin + JS)
MSG_COVERAGE_KOTLIN      := Kotlin coverage — opens HTML at android/build/reports/kover/html/
MSG_COVERAGE_JS          := JS/TS coverage — opens HTML at frontend/coverage/lcov-report/
MSG_HELP                 := Shows this help menu / Mostra este menu de ajuda
MSG_SETUP                := Validate dependencies, install JS packages and git hooks
MSG_BUILD_ANDROID        := Build debug APK
MSG_BUILD_BUNDLE         := Build JS bundle (React Native / Expo)
MSG_DEPLOY               := Install APK on physical device via USB
MSG_LOG                  := Stream app logs via adb logcat
MSG_CHECK_SHOTS          := Check that every screen and theme has a docs screenshot
MSG_EMULATOR             := Boot the docs-screenshots emulator (HEADLESS=1 for no window)
MSG_EMULATOR_STOP        := Shut the docs-screenshots emulator down
MSG_PAIR                 := Pair the phone with adb by QR code (wireless debugging)
MSG_SCREENSHOTS          := Take the docs screenshots over adb (ONLY=name, EMULATOR=1, THEMES=1 or SERIAL=...)
MSG_METRICS              := Pull app metrics/logs from the phone into metrics/<date>/ and print the report
MSG_METRICS_REPORT       := Report for an already saved pull (DIR=metrics/<date>, default: the newest)
MSG_METRICS_COMPARE      := Compare two pulls (A=... B=..., default: the two newest)
MSG_SERVER               := Start local OTA server on port 8080 (adb reverse included)
MSG_KILL                 := Force-stop the app on device (no uninstall)
MSG_REDEPLOY_LOG         := Build + kill + deploy + log, saved to /tmp/reader-log-vN.txt
MSG_NO_DEVICE            := ✗ No device connected via adb
MSG_OTA_NONE             := OTA no policy — download and apply bundle only
MSG_OTA_REQUIRED         := OTA policy=required — blocking screen, app cannot open
MSG_OTA_HIGH             := OTA policy=highly_recommended — blocking popup, app opens without downloading
MSG_OTA_RECOMMENDED      := OTA policy=recommended — advisory popup, download proceeds
MSG_CHECKING_DEPS        := → Checking dependencies...
MSG_NO_NODE              := ✗ node not found
MSG_NO_YARN              := ✗ yarn not found
MSG_NO_JAVA              := ✗ java not found
MSG_NO_ADB               := ✗ adb not found (install Android platform-tools)
MSG_CONVERT_ENV          := → Converting .env → local.properties...
MSG_INSTALL_HOOKS        := → Installing git hooks...
MSG_INSTALL_JS           := → Installing JS dependencies...
MSG_READY                := ✓ Environment ready
MSG_BUILD_ALL            := Build debug APK and JS bundle
MSG_BUILDING_APK         := → Building APK...
MSG_APK_DONE             := ✓ APK built
MSG_BUILDING_BNDL        := → Building JS bundle...
MSG_BUNDLE_DONE          := ✓ Bundle built
MSG_DEPLOYING            := → Installing on device...
MSG_DEPLOY_DONE          := ✓ Done
endif

help: ## help
	@printf "  \033[36m%-26s\033[0m %s\n" "help"                    "$(MSG_HELP)"
	@printf "  \033[36m%-26s\033[0m %s\n" "setup"                   "$(MSG_SETUP)"
	@printf "  \033[36m%-26s\033[0m %s\n" "build-android"           "$(MSG_BUILD_ANDROID)"
	@printf "  \033[36m%-26s\033[0m %s\n" "build-bundle"            "$(MSG_BUILD_BUNDLE)"
	@printf "  \033[36m%-26s\033[0m %s\n" "build-all"               "$(MSG_BUILD_ALL)"
	@printf "  \033[36m%-26s\033[0m %s\n" "deploy"                  "$(MSG_DEPLOY)"
	@printf "  \033[36m%-26s\033[0m %s\n" "kill"                    "$(MSG_KILL)"
	@printf "  \033[36m%-26s\033[0m %s\n" "log"                     "$(MSG_LOG)"
	@printf "  \033[36m%-26s\033[0m %s\n" "screenshots"             "$(MSG_SCREENSHOTS)"
	@printf "  \033[36m%-26s\033[0m %s\n" "check-screenshots"       "$(MSG_CHECK_SHOTS)"
	@printf "  \033[36m%-26s\033[0m %s\n" "emulator"                "$(MSG_EMULATOR)"
	@printf "  \033[36m%-26s\033[0m %s\n" "emulator-stop"           "$(MSG_EMULATOR_STOP)"
	@printf "  \033[36m%-26s\033[0m %s\n" "pair"                    "$(MSG_PAIR)"
	@printf "  \033[36m%-26s\033[0m %s\n" "redeploy-log"            "$(MSG_REDEPLOY_LOG)"
	@printf "  \033[36m%-26s\033[0m %s\n" "metrics"                 "$(MSG_METRICS)"
	@printf "  \033[36m%-26s\033[0m %s\n" "metrics-report"          "$(MSG_METRICS_REPORT)"
	@printf "  \033[36m%-26s\033[0m %s\n" "metrics-compare"         "$(MSG_METRICS_COMPARE)"
	@printf "  \033[36m%-26s\033[0m %s\n" "server"                  "$(MSG_SERVER)"
	@printf "  \033[36m%-26s\033[0m %s\n" "ota-none"                "$(MSG_OTA_NONE)"
	@printf "  \033[36m%-26s\033[0m %s\n" "ota-required"            "$(MSG_OTA_REQUIRED)"
	@printf "  \033[36m%-26s\033[0m %s\n" "ota-highly-recommended"  "$(MSG_OTA_HIGH)"
	@printf "  \033[36m%-26s\033[0m %s\n" "ota-recommended"         "$(MSG_OTA_RECOMMENDED)"
	@printf "  \033[36m%-26s\033[0m %s\n" "coverage"                "$(MSG_COVERAGE)"
	@printf "  \033[36m%-26s\033[0m %s\n" "coverage-kotlin"         "$(MSG_COVERAGE_KOTLIN)"
	@printf "  \033[36m%-26s\033[0m %s\n" "coverage-js"             "$(MSG_COVERAGE_JS)"

setup: ## $(MSG_SETUP)
	@echo "$(MSG_CHECKING_DEPS)"
	@command -v node >/dev/null 2>&1 || { echo "$(MSG_NO_NODE)"; exit 1; }
	@command -v yarn >/dev/null 2>&1 || { echo "$(MSG_NO_YARN)"; exit 1; }
	@command -v java >/dev/null 2>&1 || { echo "$(MSG_NO_JAVA)"; exit 1; }
	@command -v adb  >/dev/null 2>&1 || { echo "$(MSG_NO_ADB)"; exit 1; }
	@echo "$(MSG_CONVERT_ENV)"
	@scripts/env-to-local-properties.sh
	@echo "$(MSG_INSTALL_HOOKS)"
	@scripts/install-hooks.sh
	@echo "$(MSG_INSTALL_JS)"
	@cd $(FRONTEND_DIR) && yarn install
	@[ -L $(ANDROID_DIR)/node_modules ] || ln -s "$(CURDIR)/$(FRONTEND_DIR)/node_modules" $(ANDROID_DIR)/node_modules
	@echo "$(MSG_READY)"

build-android: ## $(MSG_BUILD_ANDROID)
	@echo "$(MSG_CONVERT_ENV)"
	@scripts/env-to-local-properties.sh
	@echo "$(MSG_BUILDING_APK)"
	@cd $(ANDROID_DIR) && ./gradlew :app:assembleDebug
	@echo "$(MSG_APK_DONE)"

build-all: build-bundle build-android ## $(MSG_BUILD_ALL)

build-bundle: ## $(MSG_BUILD_BUNDLE)
	@echo "$(MSG_BUILDING_BNDL)"
	@cd $(FRONTEND_DIR) && yarn bundle:android
	@date +%s000 > $(ANDROID_DIR)/app/bundle-build-time.txt
	@echo "$(MSG_BUNDLE_DONE)"

deploy: ## $(MSG_DEPLOY)
	@echo "$(MSG_DEPLOYING)"
	@[ -f $(ANDROID_DIR)/app/build/outputs/apk/debug/app-debug.apk ] || \
	  { echo "$(MSG_BUILDING_APK)"; $(MAKE) build-android; }
	@adb install -d -r $(ANDROID_DIR)/app/build/outputs/apk/debug/app-debug.apk
	@adb shell am start -n $(APP_PACKAGE)/$(APP_ACTIVITY)
	@echo "$(MSG_DEPLOY_DONE)"

kill: ## $(MSG_KILL)
	@adb shell am force-stop $(APP_PACKAGE)
	@echo "✓ $(APP_PACKAGE) encerrado"

log: ## $(MSG_LOG)
	@PID=$$(adb shell pidof $(APP_PACKAGE) 2>/dev/null | tr -d '\r'); \
	if [ -z "$$PID" ]; then \
	  echo "App não está rodando — aguardando iniciar..."; \
	  adb shell am start -n $(APP_PACKAGE)/$(APP_ACTIVITY) >/dev/null 2>&1; \
	  sleep 3; \
	  PID=$$(adb shell pidof $(APP_PACKAGE) 2>/dev/null | tr -d '\r'); \
	fi; \
	if [ -n "$$PID" ]; then \
	  echo "Logcat PID=$$PID"; \
	  adb logcat --pid=$$PID; \
	else \
	  echo "Não foi possível obter o PID — exibindo logcat filtrado por pacote:"; \
	  adb logcat | grep "$(APP_PACKAGE)"; \
	fi

check-screenshots: ## $(MSG_CHECK_SHOTS)
	@python3 scripts/check-screenshots.py

emulator: ## $(MSG_EMULATOR)
	@scripts/emulator.sh start

emulator-stop: ## $(MSG_EMULATOR_STOP)
	@scripts/emulator.sh stop

pair: ## $(MSG_PAIR)
	@scripts/adb-pair-qr.sh

screenshots: ## $(MSG_SCREENSHOTS)
	@python3 scripts/take-screenshots.py $(if $(ONLY),--only $(ONLY),) $(if $(OUT),--out $(OUT),) $(if $(SERIAL),--serial $(SERIAL),) $(if $(EMULATOR),--emulator,) $(if $(THEMES),--themes $(filter-out 1,$(THEMES)),)

redeploy-log: ## $(MSG_REDEPLOY_LOG)
	@clear; \
	adb_out=$$(adb devices); \
	echo "$$adb_out"; \
	extra_devices=$$(echo "$$adb_out" | grep -v "List of devices" | grep -v -e '^$$'); \
	device_count=$$(echo "$$extra_devices" | grep -c . || true); \
	if [ "$$device_count" -eq 0 ]; then \
	  echo "$(MSG_NO_DEVICE)"; \
	  exit 1; \
	fi; \
	if [ "$$device_count" -gt 1 ]; then \
	  serial=$$(echo "$$extra_devices" | tail -n +2 | head -n1 | awk '{print $$1}'); \
	  [ -n "$$serial" ] && adb disconnect "$$serial"; \
	fi; \
	X=$$(( $$(cat /tmp/counter.txt 2>/dev/null || echo 0) + 1 )); \
	($(MAKE) build-all && $(MAKE) kill && $(MAKE) deploy && $(MAKE) log) 2>&1 | tee /tmp/reader-log-v$${X}.txt; \
	echo $$X > /tmp/counter.txt

METRICS_DIR := metrics

metrics: ## $(MSG_METRICS)
	@scripts/metrics-pull.sh $(APP_PACKAGE) $(METRICS_DIR)

metrics-report: ## $(MSG_METRICS_REPORT)
	@D="$(DIR)"; [ -n "$$D" ] || D=$$(ls -d $(METRICS_DIR)/*/ 2>/dev/null | sort | tail -1); \
	[ -n "$$D" ] || { echo "✗ Nenhuma coleta em $(METRICS_DIR)/ — rode make metrics"; exit 1; }; \
	python3 -I scripts/metrics-report.py report "$${D%/}"

metrics-compare: ## $(MSG_METRICS_COMPARE)
	@A="$(A)"; B="$(B)"; \
	if [ -z "$$A" ] || [ -z "$$B" ]; then \
	  set -- $$(ls -d $(METRICS_DIR)/*/ 2>/dev/null | sort | tail -2); \
	  [ $$# -eq 2 ] || { echo "✗ Preciso de 2 coletas em $(METRICS_DIR)/ (ou A=... B=...)"; exit 1; }; \
	  A=$$1; B=$$2; \
	fi; \
	echo "A (antes):  $${A%/}"; echo "B (depois): $${B%/}"; echo; \
	python3 -I scripts/metrics-report.py compare "$${A%/}" "$${B%/}"

server: ## $(MSG_SERVER)
	@scripts/ota-local-server.sh

ota-none: ## $(MSG_OTA_NONE)
	@scripts/ota-serve.sh --policy none

ota-required: ## $(MSG_OTA_REQUIRED)
	@scripts/ota-serve.sh --policy required

ota-highly-recommended: ## $(MSG_OTA_HIGH)
	@scripts/ota-serve.sh --policy highly_recommended

ota-recommended: ## $(MSG_OTA_RECOMMENDED)
	@scripts/ota-serve.sh --policy recommended

coverage: coverage-kotlin coverage-js ## $(MSG_COVERAGE)

coverage-kotlin: ## $(MSG_COVERAGE_KOTLIN)
	@cd $(ANDROID_DIR) && ./gradlew koverHtmlReport koverXmlReport koverVerify --rerun-tasks
	@echo "→ Relatório HTML: $(ANDROID_DIR)/build/reports/kover/html/index.html"

coverage-js: ## $(MSG_COVERAGE_JS)
	@cd $(FRONTEND_DIR) && yarn test:coverage
	@echo "→ Relatório HTML: $(FRONTEND_DIR)/coverage/lcov-report/index.html"
