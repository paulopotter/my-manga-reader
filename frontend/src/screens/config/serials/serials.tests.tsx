import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { findPressableAncestor } from '../../../shared/test-utils/find-pressable-ancestor';

jest.mock('../../../shared/i18n/i18n.hooks', () => ({
  useStrings: () => require('../../../shared/i18n/strings').getStrings('en'),
  useLanguage: () => ({ language: 'en', setLanguage: () => {} }),
}));

const mockSortGet = jest.fn();
const mockSortPut = jest.fn();
const mockDateStyleGet = jest.fn();
const mockDateStylePut = jest.fn();
jest.mock('../../../shared/tools/chapters', () => {
  const actual = jest.requireActual('../../../shared/tools/chapters');
  return {
    ...actual,
    ChaptersTool: {
      sort: { get: (...a: unknown[]) => mockSortGet(...a), put: (...a: unknown[]) => mockSortPut(...a) },
      dateStyle: { get: (...a: unknown[]) => mockDateStyleGet(...a), put: (...a: unknown[]) => mockDateStylePut(...a) },
    },
  };
});

// The metadata-source tool is real storage behind the scenes; these tests only care about what
// the screen does with what it returns.
const mockPrefsGet = jest.fn();
const mockPutGlobal = jest.fn();
const mockPutField = jest.fn();
jest.mock('../../../shared/tools/metadata-sources', () => {
  const actual = jest.requireActual('../../../shared/tools/metadata-sources');
  return {
    ...actual,
    MetadataSourcesTool: {
      ...actual.MetadataSourcesTool,
      preferences: {
        get: (...a: unknown[]) => mockPrefsGet(...a),
        putGlobal: (...a: unknown[]) => mockPutGlobal(...a),
        putField: (...a: unknown[]) => mockPutField(...a),
      },
    },
  };
});

import { getStrings } from '../../../shared/i18n/strings';
import { useChapterDateStyle, useMetadataSources, useSerialsSort } from './serials.hooks';
import { SerialsSortScreen } from './serials.screen';

const t = getStrings('en');
const PREFS = { mode: 'AUTO_FIXED' as const, fixedThreshold: 100, progressPercent: 70 };

beforeEach(() => {
    mockDateStyleGet.mockResolvedValue('LANGUAGE');
    mockDateStylePut.mockResolvedValue(undefined);
    mockPrefsGet.mockResolvedValue({ global: 'enrichment', fields: {} });
    mockPutGlobal.mockResolvedValue({ global: 'enrichment', fields: {} });
    mockPutField.mockResolvedValue({ global: 'enrichment', fields: {} });
  jest.clearAllMocks();
  mockSortGet.mockResolvedValue(PREFS);
  mockSortPut.mockResolvedValue(undefined);
});

describe('useSerialsSort', () => {
  it('loads the global sort prefs and clears loading', async () => {
    const { result } = renderHook(() => useSerialsSort());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSortGet).toHaveBeenCalledWith({ domain: 'global' });
    expect(result.current.mode).toBe('AUTO_FIXED');
    expect(result.current.fixedThreshold).toBe(100);
    expect(result.current.progressPercent).toBe(70);
  });

  it('change() updates local state and persists under the global scope', async () => {
    const { result } = renderHook(() => useSerialsSort());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change('ASCENDING', undefined, 50));

    expect(result.current.mode).toBe('ASCENDING');
    expect(result.current.fixedThreshold).toBeUndefined();
    expect(mockSortPut).toHaveBeenCalledWith(
      { domain: 'global' },
      { mode: 'ASCENDING', fixedThreshold: undefined, progressPercent: 50 },
    );
  });
});

describe('SerialsSortScreen', () => {
  it('renders the group title after loading', async () => {
    const { getByText } = render(<SerialsSortScreen onBack={jest.fn()} />);
    await waitFor(() => expect(getByText(t.configChapterSortGroupTitle)).toBeTruthy());
  });

  it('the back chevron calls onBack', async () => {
    const onBack = jest.fn();
    const { getByText, UNSAFE_getByType } = render(<SerialsSortScreen onBack={onBack} />);
    await waitFor(() => expect(getByText(t.configChapterSortGroupTitle)).toBeTruthy());
    fireEvent.press(findPressableAncestor(UNSAFE_getByType(ChevronLeft), TouchableOpacity) as never);
    expect(onBack).toHaveBeenCalled();
  });
});

describe('SerialsSortScreen — chapter date format', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSortGet.mockResolvedValue({ mode: 'ASCENDING', progressPercent: 50 });
    mockPrefsGet.mockResolvedValue({ global: 'enrichment', fields: {} });
    mockDateStyleGet.mockResolvedValue('LANGUAGE');
    mockDateStylePut.mockResolvedValue(undefined);
  });

  it('shows the date-format section, with the current choice and a sample', async () => {
    const { findByText } = render(<SerialsSortScreen onBack={jest.fn()} />);
    expect(await findByText(t.configChapterDateGroupTitle)).toBeTruthy();
    expect(await findByText(t.configChapterDateRowLabel)).toBeTruthy();
    expect(await findByText(`${t.configChapterDateFollowLanguage} (11/08/2026)`)).toBeTruthy();
  });

  it('useChapterDateStyle loads the stored style and writes a change through', async () => {
    mockDateStyleGet.mockResolvedValue('YMD');
    const { result } = renderHook(() => useChapterDateStyle());
    await waitFor(() => expect(result.current.style).toBe('YMD'));
    act(() => result.current.change('DMY'));
    expect(result.current.style).toBe('DMY');
    expect(mockDateStylePut).toHaveBeenCalledWith({ style: 'DMY' });
  });
});

describe('SerialsSortScreen — metadata source', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSortGet.mockResolvedValue({ mode: 'ASCENDING', progressPercent: 50 });
    mockPrefsGet.mockResolvedValue({ global: 'enrichment', fields: {} });
    mockPutGlobal.mockResolvedValue({ global: 'content', fields: {} });
    mockPutField.mockResolvedValue({ global: 'enrichment', fields: { genres: 'content' } });
  });

  it('shows the data-source section once loaded', async () => {
    const { findByText } = render(<SerialsSortScreen onBack={jest.fn()} />);
    expect(await findByText(t.configMetadataSourceGroupTitle)).toBeTruthy();
    expect(await findByText(t.configMetadataSourceRowLabel)).toBeTruthy();
  });

  // The per-field page is reached from the row, not from the Config menu — so that going back
  // from it lands on this screen instead of jumping out to the menu.
  it('opens the per-field page from the row and comes back to this screen', async () => {
    const onBack = jest.fn();
    const { findByText, getByText, queryByText, UNSAFE_getByType } = render(<SerialsSortScreen onBack={onBack} />);

    await findByText(t.configMetadataSourceRowLabel);
    fireEvent.press(findPressableAncestor(UNSAFE_getByType(ChevronRight), TouchableOpacity) as never);
    expect(getByText(t.configMetadataSourceFieldsTitle)).toBeTruthy();

    // Back here closes the sub-page; it must not leave the screen entirely.
    fireEvent.press(findPressableAncestor(UNSAFE_getByType(ChevronLeft), TouchableOpacity) as never);
    await waitFor(() => expect(queryByText(t.configMetadataSourceGroupTitle)).toBeTruthy());
    expect(onBack).not.toHaveBeenCalled();
  });

  it('switches the primary server from the toggle', async () => {
    const { findByText } = render(<SerialsSortScreen onBack={jest.fn()} />);

    fireEvent.press(await findByText(t.configMetadataSourceContentShort));

    expect(mockPutGlobal).toHaveBeenCalledWith({ source: 'content' });
  });

  it('lists one row per disputed field', async () => {
    const { findByText, getByText, UNSAFE_getByType } = render(<SerialsSortScreen onBack={jest.fn()} />);
    await findByText(t.configMetadataSourceRowLabel);
    fireEvent.press(findPressableAncestor(UNSAFE_getByType(ChevronRight), TouchableOpacity) as never);

    [t.configMetadataFieldSummary, t.configMetadataFieldGenres, t.configMetadataFieldAuthor, t.configMetadataFieldStatus, t.configMetadataFieldAlternativeTitles].forEach(
      label => expect(getByText(label)).toBeTruthy(),
    );
  });
});

describe('useMetadataSources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrefsGet.mockResolvedValue({ global: 'enrichment', fields: { genres: 'content' } });
    mockPutGlobal.mockResolvedValue({ global: 'content', fields: {} });
    mockPutField.mockResolvedValue({ global: 'enrichment', fields: {} });
  });

  it('loads the stored preferences', async () => {
    const { result } = renderHook(() => useMetadataSources());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.preferences).toEqual({ global: 'enrichment', fields: { genres: 'content' } });
  });

  // Answering for everything clears the exceptions — otherwise a field pinned earlier would keep
  // contradicting the answer the user just gave.
  it('clears every per-field choice when the global changes', async () => {
    const { result } = renderHook(() => useMetadataSources());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.changeGlobal('content');
    });

    expect(mockPutGlobal).toHaveBeenCalledWith({ source: 'content' });
    await waitFor(() => expect(result.current.preferences.fields).toEqual({}));
  });

  it('writes a per-field choice through', async () => {
    const { result } = renderHook(() => useMetadataSources());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.changeField({ field: 'summary', choice: 'content' });
    });

    expect(mockPutField).toHaveBeenCalledWith({ field: 'summary', choice: 'content' });
  });

  it('drops a field that goes back to inherit', async () => {
    const { result } = renderHook(() => useMetadataSources());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.changeField({ field: 'genres', choice: 'inherit' });
    });

    expect(mockPutField).toHaveBeenCalledWith({ field: 'genres', choice: 'inherit' });
  });
});
