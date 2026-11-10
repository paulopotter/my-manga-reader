import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, Text, TouchableOpacity, View } from 'react-native';
// Config deliberately reaches into the screen it configures — ChapterSortFields is the exact same
// fields the SerieScreen sort modal shows, only the save scope differs (global here, per-series
// there). It lives in screens/serie/, not shared/, because config + that one screen are its only
// callers; promote it to shared/ if a third screen ever needs it.
import { ChapterSortFields } from '../../../screens/serie/components/chapter-sort';
import { useLanguage, useStrings } from '../../../shared/i18n';
import type { Strings } from '../../../shared/i18n';
import { BackChevron, Select } from '../components';
import { IconButton } from '../../../shared/components/icon-button';
import {
  DISPUTED_METADATA_FIELDS,
  type DisputedMetadataField,
  type MetadataSourceChoice,
  type MetadataSourcePreferences,
} from '../../../shared/tools/metadata-sources';

import { DATE_STYLES, DateTool, type DateStyle } from '../../../shared/tools/date';
import { useChapterDateStyle, useMetadataSources, useSerialsSort } from './serials.hooks';
import { ChevronRight } from 'lucide-react-native';
import { icon } from '../../../shared/theme';
import { useStyles, useTheme } from '../../../shared/context';
import { configStyles as makeChrome } from '../config.styles';
import { serialsStyles } from './serials.styles';

// Everything the serial page can be configured with. Folder named after the domain it configures
// (serials), scoped inside screens/config/.
//
// The per-field picker is a page of its own, reached from the row below it — and it is local
// state rather than a ConfigSubScreen of its own, so that going back from it lands here instead
// of jumping all the way out to the Config menu (which is what the router's own back does).
export function SerialsSortScreen({ onBack }: { onBack: () => void }) {
  const chrome = useStyles(makeChrome);
  const styles = useStyles(serialsStyles);
  const { colors } = useTheme();
  const t = useStrings();
  const { loading, mode, fixedThreshold, progressPercent, change } = useSerialsSort();
  const sources = useMetadataSources();
  const dateStyle = useChapterDateStyle();
  const { language } = useLanguage();
  const [showFields, setShowFields] = useState(false);

  // While the sub-page is open, back closes it instead of leaving this screen. Registered here
  // and not in the router because the router knows nothing about a page nested inside a
  // sub-screen — and this listener, added later, runs before the router's own.
  useEffect(() => {
    if (!showFields) {return;}
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowFields(false);
      return true;
    });
    return () => sub.remove();
  }, [showFields]);

  if (showFields) {
    return (
      <MetadataFieldsPage
        preferences={sources.preferences}
        onChangeField={sources.changeField}
        onBack={() => setShowFields(false)}
        t={t}
      />
    );
  }

  return (
    <View style={chrome.root}>
      <View style={chrome.subHeader}>
        <BackChevron onPress={onBack} />
        <Text style={chrome.subTitle}>{t.configMenuSerials}</Text>
      </View>

      {!loading && (
        <ScrollView contentContainerStyle={chrome.scroll}>
          <Text style={chrome.section}>{t.configChapterSortGroupTitle}</Text>
          <ChapterSortFields
            mode={mode}
            fixedThreshold={fixedThreshold}
            progressPercent={progressPercent}
            t={t}
            onChange={change}
          />

          <Text style={chrome.section}>{t.configChapterDateGroupTitle}</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.configChapterDateRowLabel}</Text>
            <Select
              value={dateStyle.style}
              options={dateStyleOptions({ t, language })}
              placeholder={t.configChapterDateFollowLanguage}
              onChange={id => dateStyle.change((id ?? 'LANGUAGE') as DateStyle)}
            />
          </View>

          <Text style={chrome.section}>{t.configMetadataSourceGroupTitle}</Text>
          {/* One line: what it is, which side is picked, and a way into the per-field page. The
              toggle decides for every field at once (and, per the tool's own rule, clears
              whatever was set per field); the chevron opens the exceptions. */}
          <View style={styles.sourceRow}>
            <Text style={styles.sourceLabel}>{t.configMetadataSourceRowLabel}</Text>
            {/* Content on one side, enrichment on the other, the picked side filled in — a
                two-value choice reads faster as a toggle than as a dropdown. */}
            <View style={styles.toggle}>
              {(['content', 'enrichment'] as const).map(source => {
                const active = sources.preferences.global === source;
                return (
                  <TouchableOpacity
                    key={source}
                    onPress={() => sources.changeGlobal(source)}
                    style={[styles.toggleSide, active && styles.toggleSideActive]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}>
                    <Text style={[styles.toggleText, active && styles.toggleTextActive]} numberOfLines={1}>
                      {source === 'content' ? t.configMetadataSourceContentShort : t.configMetadataSourceEnrichmentShort}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <IconButton
              icon={ChevronRight}
              glyph="chevron"
              size={icon.size[5]}
              color={colors.icon.secondary}
              onPress={() => setShowFields(true)}
              accessibilityLabel={t.configMetadataSourceFieldsTitle}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// One row per disputed field. The list comes from the domain (DISPUTED_METADATA_FIELDS), never
// from a copy kept here — so a field added to the resolver shows up on this page on its own.
function MetadataFieldsPage({
  preferences,
  onChangeField,
  onBack,
  t,
}: {
  preferences: MetadataSourcePreferences;
  onChangeField: (args: { field: DisputedMetadataField; choice: MetadataSourceChoice }) => void;
  onBack: () => void;
  t: Strings;
}) {
  const chrome = useStyles(makeChrome);
  const styles = useStyles(serialsStyles);

  return (
    <View style={chrome.root}>
      <View style={chrome.subHeader}>
        <BackChevron onPress={onBack} />
        <Text style={chrome.subTitle}>{t.configMetadataSourceFieldsTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={chrome.scroll}>
        <Text style={styles.hint}>{t.configMetadataSourceFieldsHint}</Text>
        {DISPUTED_METADATA_FIELDS.map(field => (
          <View key={field} style={styles.field}>
            <Text style={styles.fieldLabel}>{fieldLabel(field, t)}</Text>
            <Select
              value={preferences.fields[field] ?? 'inherit'}
              options={fieldOptions(t)}
              placeholder={t.configMetadataSourceInherit}
              onChange={id => onChangeField({ field, choice: (id ?? 'inherit') as MetadataSourceChoice })}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const SAMPLE_DAY = new Date(2026, 10, 8).getTime();
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// One option per date shape, each with a sample so the result is seen before it is picked. The
// list comes from the tool (DATE_STYLES); only the names are said here, since only the screen has `t`.
function dateStyleOptions({ t, language }: { t: Strings; language: string }) {
  const names: Record<DateStyle, string> = {
    LANGUAGE: t.configChapterDateFollowLanguage,
    DMY: 'DD/MM/YYYY',
    MDY: 'MM/DD/YYYY',
    YMD: 'YYYY-MM-DD',
    DMY_SHORT: 'DD/MM/YY',
    RELATIVE: t.configChapterDateRelative,
  };
  return DATE_STYLES.map(style => {
    const epochMs = style === 'RELATIVE' ? Date.now() - THREE_DAYS_MS : SAMPLE_DAY;
    return { id: style, label: `${names[style]} (${DateTool.format.to.date({ epochMs, style, language, t })})` };
  });
}

const sourceOptions = (t: Strings) => [
  { id: 'enrichment', label: t.configMetadataSourceEnrichment },
  { id: 'content', label: t.configMetadataSourceContent },
];

// 'inherit' is first because it is the default state of every field.
const fieldOptions = (t: Strings) => [{ id: 'inherit', label: t.configMetadataSourceInherit }, ...sourceOptions(t)];

// Field labels live here rather than on the domain constant: the domain names a field, the screen
// decides how to say it, and only the screen has `t`.
function fieldLabel(field: DisputedMetadataField, t: Strings): string {
  switch (field) {
    case 'summary':
      return t.configMetadataFieldSummary;
    case 'genres':
      return t.configMetadataFieldGenres;
    case 'author':
      return t.configMetadataFieldAuthor;
    case 'status':
      return t.configMetadataFieldStatus;
    case 'alternativeTitles':
      return t.configMetadataFieldAlternativeTitles;
  }
}
