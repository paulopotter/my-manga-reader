import React from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useStrings } from '../../../shared/i18n';
import { HOME_WINDOW_DAYS_OPTIONS } from '../../../shared/tools/home-settings';
import { useStyles, useTheme } from '../../../shared/context';
import { BackChevron, Select } from '../components';
import { configStyles as makeChrome } from '../config.styles';
import { useHomeSettings } from './home.hooks';
import { homeStyles } from './home.styles';

// A Switch row whose whole line is a toggle target, like the notification settings' own.
function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  const styles = useStyles(homeStyles);
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onValueChange(!value)}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? colors.button.switch.thumb.on : colors.button.switch.thumb.off}
        trackColor={{ false: colors.button.switch.track.off, true: colors.button.switch.track.on }}
      />
    </TouchableOpacity>
  );
}

// What the Home rails show: which series "New in library" leaves out and how far back it looks, whether
// "Recently updated" keeps what is fully read, and whether "Followed series updated" counts only a
// chapter at the end of the series.
export function HomeSettingsScreen({ onBack }: { onBack: () => void }) {
  const chrome = useStyles(makeChrome);
  const styles = useStyles(homeStyles);
  const t = useStrings();
  const { loading, settings, change } = useHomeSettings();

  const windowOptions = HOME_WINDOW_DAYS_OPTIONS.map(days => ({ id: String(days), label: t.configHomeWindowDays.replace('{0}', String(days)) }));

  return (
    <View style={chrome.root}>
      <View style={chrome.subHeader}>
        <BackChevron onPress={onBack} />
        <Text style={chrome.subTitle}>{t.configMenuHome}</Text>
      </View>

      {!loading && (
        <ScrollView contentContainerStyle={chrome.scroll}>
          <Text style={chrome.section}>{t.configHomeNewTitle}</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.configHomeNewWindow}</Text>
            <Select
              value={String(settings.newInLibraryWindowDays)}
              options={windowOptions}
              onChange={id => id && change({ newInLibraryWindowDays: Number(id) })}
            />
          </View>
          <ToggleRow
            label={t.configHomeNewHideFollowedReading}
            value={settings.newInLibraryHideFollowedAndReading}
            onValueChange={value => change({ newInLibraryHideFollowedAndReading: value })}
          />

          <Text style={chrome.section}>{t.configHomeUpdatedTitle}</Text>
          <ToggleRow
            label={t.configHomeUpdatedHideFullyRead}
            value={settings.recentlyUpdatedHideFullyRead}
            onValueChange={value => change({ recentlyUpdatedHideFullyRead: value })}
          />

          <Text style={chrome.section}>{t.configHomeFollowedTitle}</Text>
          <ToggleRow
            label={t.configHomeFollowedOnlyNewAtEnd}
            value={settings.followedOnlyNewAtEnd}
            onValueChange={value => change({ followedOnlyNewAtEnd: value })}
          />
        </ScrollView>
      )}
    </View>
  );
}
