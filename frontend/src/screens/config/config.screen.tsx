import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AppVersions } from '../../shared/components/app-versions';
import { useStrings } from '../../shared/i18n';
import { type ThemeName, defaultThemeName, icon, themes } from '../../shared/theme';
import { useTheme } from '../../shared/context';
import type { StartScreen } from '../../shared/tools/startup';
import { ThemeLabelsTool } from '../../shared/tools/theme-labels';
import { Select } from './components/select';
import { LanguageToggle } from './components/language-toggle';
import { useConfigLanguage, useConfigMenu, useConfigStartScreen } from './config.hooks';
import { configStyles } from './config.styles';
import type { ConfigScreenProps, ConfigSubScreen } from './config.types';
import { AdultFilterScreen } from './adult';
import { DebugScreen } from './debug';
import { NotificationsScreen } from './notifications';
import { ReaderPrefsScreen } from './reader';
import { SerialsSortScreen } from './serials';
import { HomeSettingsScreen } from './home';
import { ServerScreen } from './server';

// How long Config may stay off screen before it forgets its sub-level and reopens on the menu.
export const CONFIG_RESET_DELAY_MS = 10_000;

// Thin router: the Config menu + which sub-screen is open. All the real work is in each sub-screen
// (server/reader/serie/debug), each its own folder on the current convention. 'setup' is not
// routed here — see config.types.
export function ConfigScreen({ onRegisterBackHandler, onServerCleared, focused = true }: ConfigScreenProps) {
  const [screen, setScreen] = useState<ConfigSubScreen>('menu');
  const goBack = () => setScreen('menu');

  // Off screen for a while → back to the menu. Returning sooner cancels the countdown, so a quick
  // glance at another tab keeps the sub-level.
  useEffect(() => {
    if (focused || screen === 'menu') {
      return;
    }
    const timer = setTimeout(() => setScreen('menu'), CONFIG_RESET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focused, screen]);

  useEffect(() => {
    if (screen === 'menu') {
      onRegisterBackHandler?.(null);
      return;
    }
    onRegisterBackHandler?.(() => {
      goBack();
      return true;
    });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  switch (screen) {
    case 'server':
      return <ServerScreen onBack={goBack} onServerCleared={onServerCleared} />;
    case 'reader':
      return <ReaderPrefsScreen onBack={goBack} />;
    case 'serials':
      return <SerialsSortScreen onBack={goBack} />;
    case 'home':
      return <HomeSettingsScreen onBack={goBack} />;
    case 'notifications':
      return <NotificationsScreen onBack={goBack} />;
    case 'adult':
      return <AdultFilterScreen onBack={goBack} />;
    case 'debug':
      return <DebugScreen onBack={goBack} />;
    default:
      return <ConfigMenu onNavigate={setScreen} />;
  }
}

// ── Menu ─────────────────────────────────────────────────────────────────────
function ConfigMenu({ onNavigate }: { onNavigate: (s: ConfigSubScreen) => void }) {
  const { colors, text, themeName, available, setTheme } = useTheme();
  const styles = useMemo(() => configStyles({ colors, text }), [colors, text]);
  const t = useStrings();
  const { language, changeLanguage } = useConfigLanguage();
  const { debugUnlocked, unlockDebug } = useConfigMenu();
  const { startScreen, changeStartScreen } = useConfigStartScreen();

  const startScreenOptions = useMemo(
    () => [
      { id: 'dashboard', label: t.configStartScreenHome },
      { id: 'following', label: t.configStartScreenFollowing },
    ],
    [t],
  );

  const themeOptions = useMemo(
    () =>
      available.map(name => ({
        id: name,
        // The default is marked, not named: if the role moves to another identity, the label
        // follows on its own.
        label:
          name === defaultThemeName
            ? `${ThemeLabelsTool.labelOf(name, t)} - ${t.themeDefaultSuffix}`
            : ThemeLabelsTool.labelOf(name, t),
        // Read from the registry, not from useTheme(): a swatch samples an identity that is
        // deliberately NOT the active one, so its colours cannot come through the style layer.
        swatch: { accent: themes[name].button.primary, surface: themes[name].surface.primary },
      })),
    [available, t],
  );

  return (
    <View style={styles.root}>
      <Text style={styles.pageTitle}>{t.configTitle}</Text>

      <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('server')}>
        <Text style={styles.menuRowLabel}>{t.configMenuServer}</Text>
        <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
      </TouchableOpacity>
      <View style={[styles.divider, styles.dividerInset]} />

      <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('reader')}>
        <Text style={styles.menuRowLabel}>{t.configMenuReading}</Text>
        <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
      </TouchableOpacity>
      <View style={[styles.divider, styles.dividerInset]} />

      <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('serials')}>
        <Text style={styles.menuRowLabel}>{t.configMenuSerials}</Text>
        <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
      </TouchableOpacity>
      <View style={[styles.divider, styles.dividerInset]} />

      <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('home')}>
        <Text style={styles.menuRowLabel}>{t.configMenuHome}</Text>
        <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
      </TouchableOpacity>
      <View style={[styles.divider, styles.dividerInset]} />

      <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('notifications')}>
        <Text style={styles.menuRowLabel}>{t.configMenuNotifications}</Text>
        <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
      </TouchableOpacity>
      <View style={[styles.divider, styles.dividerInset]} />

      <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('adult')}>
        <Text style={styles.menuRowLabel}>{t.configMenuAdult}</Text>
        <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
      </TouchableOpacity>
      <View style={[styles.divider, styles.dividerInset]} />

      <Text style={styles.themeLabel}>{t.configMenuStartScreen}</Text>
      <View style={styles.themeField}>
        <Select
          value={startScreen}
          options={startScreenOptions}
          onChange={(id: string | undefined) => id && changeStartScreen(id as StartScreen)}
        />
      </View>

      <Text style={styles.themeLabel}>{t.configMenuTheme}</Text>
      <View style={styles.themeField}>
        <Select
          value={themeName}
          options={themeOptions}
          onChange={(id: string | undefined) => id && setTheme(id as ThemeName)}
        />
      </View>

      {debugUnlocked && (
        <>
          <TouchableOpacity style={styles.menuRow} onPress={() => onNavigate('debug')}>
            <Text style={styles.menuRowLabel}>Debug</Text>
            <ChevronRight size={icon.size[5]} color={colors.icon.secondary} />
          </TouchableOpacity>
          <View style={[styles.divider, styles.dividerInset]} />
        </>
      )}

      <View style={styles.menuFooter}>
        <LanguageToggle language={language} onChange={changeLanguage} />
        <AppVersions t={t} onDebugUnlocked={unlockDebug} />
      </View>
    </View>
  );
}
