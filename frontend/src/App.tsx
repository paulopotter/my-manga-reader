import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, StatusBar, Text, TextInput, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageContext, getStrings } from './shared/i18n';
import { ConfigRepository, StartupBridge } from './shared/bridge';
import { AdultFilterProvider } from './shared/context/adult-filter';
import { StartupProvider } from './shared/context/startup';
import { ImmersiveProvider, useImmersive } from './shared/context/immersive';
import { registerSeriesDigestIndexListener } from './shared/managers/store';
import { registerNotificationHistoryListener } from './shared/services/notifications';
import { RootNavigator, Routes, BOTTOM_NAV_ROUTES } from './navigation';
import { linking } from './navigation/linking.config';
import { MAX_FONT_SCALE } from './shared/theme';
import { ThemeProvider, useTheme } from './shared/context';
import { NotificationToastHost } from './shared/context/notification-toast';

// Caps how far the device's font-size setting may enlarge text, app-wide. Set once on the
// components' defaults rather than on every <Text>, so a screen added later inherits it without
// anyone remembering to.
type ScalableDefaults = { defaultProps?: { maxFontSizeMultiplier?: number } };
(Text as unknown as ScalableDefaults).defaultProps = {
  ...(Text as unknown as ScalableDefaults).defaultProps,
  maxFontSizeMultiplier: MAX_FONT_SCALE,
};
(TextInput as unknown as ScalableDefaults).defaultProps = {
  ...(TextInput as unknown as ScalableDefaults).defaultProps,
  maxFontSizeMultiplier: MAX_FONT_SCALE,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ImmersiveProvider>
          <AppContent />
        </ImmersiveProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { colors } = useTheme();
  const [language, setLanguageState] = useState('pt-BR');

  const navRef = useRef<NavigationContainerRef<any>>(null);

  // Setting the language means setting the OS per-app locale, then reflecting that in the
  // context. There is no app-side "language" preference — the OS is the single source of truth,
  // so a change made in Android's App-languages settings shows up here on the next boot, and a
  // change made here shows up in those settings.
  const applyLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    ConfigRepository.setAppLocale(lang).catch(() => {});
  }, []);

  useEffect(() => {
    // App-wide listeners that must run whether or not their consuming screen ever mounts. Kept
    // as an explicit boot call, not an import side effect. Idempotent.
    registerSeriesDigestIndexListener();
    registerNotificationHistoryListener();

    async function boot() {
      const lang = await ConfigRepository.getAppLocale().catch(() => 'en');
      setLanguageState(lang);

      // Restored-route boot (reopen on the last screen after the app was killed) — deferred.
      // The idea (to revisit): resolve `getRestoredRoute()` here and pass a dynamic
      // `initialRoute` to RootNavigator instead of the splash, so a deep session state doesn't
      // flash the splash first. Left out until the trade-offs (vs. letting the splash always run
      // and navigate) are worked through.
      //   let restoredRoute: string | null = null;
      //   try { restoredRoute = await StartupBridge.getRestoredRoute(); } catch {}
      //   if (restoredRoute && (await StartupBridge.hasServerConfigured().catch(() => false))) {
      //     setInitialRoute(mapRestored(restoredRoute));
      //   }
    }
    boot().catch(() => { /* splash runs and decides */ });
  }, [applyLanguage]);

  // The user changed the language in Android's per-app settings while the app is open — the
  // Activity handled the config change without a restart (configChanges includes `locale`) and
  // pinged us. Re-read the effective locale and re-render; don't write it back (the OS already
  // holds it).
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('appLocaleChanged', () => {
      ConfigRepository.getAppLocale()
        .then(setLanguageState)
        .catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const onNavigationStateChange = useCallback(() => {
    const currentRoute = navRef.current?.getCurrentRoute();
    if (!currentRoute) { return; }
    const name = currentRoute.name;
    const isRoot = BOTTOM_NAV_ROUTES.has(name);
    StartupBridge.notifyRouteChanged(name, isRoot, isRoot ? name : undefined).catch(() => {});
  }, []);

  // useSafeAreaInsets reage a mudanças reais de inset (rotação, cutout dinâmico, densidade) —
  // diferente de StatusBar.currentHeight (lido uma única vez, síncrono, no primeiro render),
  // que podia vir desatualizado/0 se o layout nativo ainda não tivesse se estabilizado quando o
  // JS montou, deixando o conteúdo atrás da barra de notificação até o próximo reload do app.
  const insets = useSafeAreaInsets();
  const { immersive, setTopInset } = useImmersive();
  // Immersive zeroes the native insets, so keep the last real value for screens drawing behind the cutout.
  useEffect(() => {
    if (!immersive) { setTopInset(insets.top); }
  }, [immersive, insets.top, setTopInset]);
  // Immersive (the Reader, when its immersive-mode pref is on) draws edge-to-edge, behind the
  // status bar and the cutout — so drop the root paddingTop the other screens want. When the
  // Reader is open but immersive is off, the padding stays and the status bar area is respected.
  const statusBarHeight = immersive ? 0 : insets.top;

  return (
    <LanguageContext.Provider value={{ language, strings: getStrings(language), setLanguage: applyLanguage }}>
      <StatusBar backgroundColor={colors.surface.primary} barStyle="light-content" translucent={false} />
      <View style={[{ flex: 1, backgroundColor: colors.surface.primary }, { paddingTop: statusBarHeight }]}>
        <AdultFilterProvider>
        <StartupProvider>
          <NavigationContainer ref={navRef} linking={linking} onStateChange={onNavigationStateChange}>
            <RootNavigator
              onSetupComplete={() => {
                navRef.current?.reset({ index: 0, routes: [{ name: Routes.HUB }] });
              }}
            />
            <NotificationToastHost />
          </NavigationContainer>
        </StartupProvider>
        </AdultFilterProvider>
      </View>
    </LanguageContext.Provider>
  );
}

