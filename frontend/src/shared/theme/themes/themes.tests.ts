import { colors, themes, activeTheme, defaultThemeName } from './index';
import { ColorTool } from '../tools/color.tool';
import type { ThemeColors } from '../colors.types';

// What these tests defend is the *contract*, not the values. A theme may repaint anything; what it
// may not do is leave a role unfilled, invent a name outside the contract, or smuggle a brightness
// word into one — those are the mistakes that only surface once a second identity exists, which is
// exactly when they are expensive.

const everyLeaf = (node: unknown, path: string[] = []): Array<[string, string]> =>
  typeof node === 'string'
    ? [[path.join('.'), node]]
    : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => everyLeaf(v, [...path, k]));

describe('theme registry', () => {
  it('exposes the active theme as `colors`', () => {
    expect(colors).toBe(themes[activeTheme]);
  });

  it('registers every theme under a name', () => {
    expect(Object.keys(themes).length).toBeGreaterThan(0);
    expect(themes).toHaveProperty(activeTheme);
  });
});

describe('every theme fills the contract', () => {
  const names = Object.keys(themes) as Array<keyof typeof themes>;

  it.each(names)('%s defines a non-empty value for every token', name => {
    const leaves = everyLeaf(themes[name]);
    expect(leaves.length).toBeGreaterThan(0);
    for (const [path, value] of leaves) {
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
      // Every token is an opaque `rgb()` triple. The type already enforces the shape; this
      // guards the halves it cannot see — that the channels are real 0-255 numbers, and that no
      // alpha crept in (opacity is the call site's, applied with `ColorTool.add.alpha()`).
      const channels = /^rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)$/.exec(value);
      expect(channels).not.toBeNull();
      for (const channel of channels!.slice(1)) {
        expect(Number(channel)).toBeLessThanOrEqual(255);
      }
      expect(path).toBeTruthy();
    }
  });

  it.each(names)('%s uses exactly the same token paths as every other theme', name => {
    const reference = everyLeaf(themes[names[0]]).map(([p]) => p).sort();
    const actual = everyLeaf(themes[name]).map(([p]) => p).sort();
    expect(actual).toEqual(reference);
  });
});

describe('token names', () => {
  // Decision 1 of plan 028: a name describes a role, never a brightness. `textOnDark` stops being
  // true the moment an identity is not dark.
  it.each(['dark', 'light', 'white', 'black', 'bright'])('no token path contains "%s"', word => {
    const offenders = everyLeaf(colors)
      .map(([path]) => path)
      .filter(path => path.toLowerCase().includes(word));
    expect(offenders).toEqual([]);
  });
});

// The launcher icon and the native splash are compiled into the APK and painted before any code
// runs, so they cannot read a token — android/app/src/main/res/values/colors.xml holds a copy.
// These are the values that file must carry; if the default role moves to another identity, this
// test fails and says so, instead of the app booting with last identity's colours.
// Readability is the one promise a palette cannot break: a theme may repaint anything, but not
// into something that cannot be read. 7:1 is WCAG AAA for body text.
// The picker shows the registry in its own order, and `generate-theme.js` inserts into it
// automatically — which only works while the order stays mechanical.
describe('the registry order', () => {
  const keys = Object.keys(themes);
  const identities = keys.filter(k => !k.endsWith('Oled'));

  it('lists identities alphabetically by key', () => {
    expect(identities).toEqual([...identities].sort());
  });

  // By key and not by label: the label is a translation, so sorting on it would reshuffle the
  // list when the language changes.
  it('pins each OLED variant directly under its parent', () => {
    for (const [index, key] of keys.entries()) {
      if (!key.endsWith('Oled')) {continue;}
      expect(keys[index - 1]).toBe(key.slice(0, -4));
    }
  });

  it('has a parent for every variant', () => {
    for (const key of keys.filter(k => k.endsWith('Oled'))) {
      expect(keys).toContain(key.slice(0, -4));
    }
  });
});

describe('legibility', () => {
  const channel = (token: string): number[] => (token.match(/\d+/g) ?? []).map(Number);
  const luminance = (token: string): number => {
    const [r, g, b] = channel(token).map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const named = Object.entries(themes);

  // Two identities predate this rule and keep their colours by decision — see INHERITED below.
  // Everything drawn since is held to AAA.
  const INHERITED = ['teal', 'crimson'];
  const floorFor = (name: string): number => (INHERITED.some(i => name.startsWith(i)) ? 4.5 : 7);

  // The screen and the card are where prose is read, so both foregrounds clear AAA there.
  // `surface.tertiary` is deliberately NOT in this list: it is the chip, the switch track, the
  // cover placeholder — small raised shapes that carry a label at most, never a paragraph.
  // Holding it to the same bar would mean lightening every secondary for no gain in reading.
  it.each(named)('%s reads body copy on the screen and on a card', (name, palette) => {
    for (const surface of [palette.surface.primary, palette.surface.secondary]) {
      expect(contrast(palette.text.primary, surface)).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.text.secondary, surface)).toBeGreaterThanOrEqual(floorFor(name));
    }
  });

  // On that raised surface the bar is AA, which is what a short label needs.
  it.each(named)('%s keeps a label legible on a raised surface', (_name, palette) => {
    expect(contrast(palette.text.primary, palette.surface.tertiary)).toBeGreaterThanOrEqual(7);
    expect(contrast(palette.text.secondary, palette.surface.tertiary)).toBeGreaterThanOrEqual(4.5);
  });

  // The reader's error screen sits a secondary button on the black page. Its label is
  // `text.button.secondary`, which is the one named after that fill — the primary label on it read
  // 1.1–1.5:1 in six of the eight identities.
  it.each(named)('%s reads the label of a secondary button', (_name, palette) => {
    expect(contrast(palette.text.button.secondary, palette.button.secondary)).toBeGreaterThanOrEqual(7);
  });

  it.each(named)('%s reads its heading and its label', (_name, palette) => {
    expect(contrast(palette.text.title.primary, palette.surface.secondary)).toBeGreaterThanOrEqual(7);
    expect(contrast(palette.text.label, palette.surface.secondary)).toBeGreaterThanOrEqual(7);
  });

  /**
   * Teal and crimson are the two identities that predate this rule, and both keep their colours by
   * an explicit decision rather than by oversight:
   *
   * - **crimson** is the app's original identity; its red accent reads 4.15 against the card. The
   *   alternative was a lighter red that is no longer the colour the app shipped with.
   * - **teal** was drawn to prove runtime switching, before there was a measured bar. Its
   *   secondary text reads 6.30 and its cyan link 6.69 — both just under AAA, and both approved on
   *   the device as they are.
   *
   * Their OLED variants inherit the same foregrounds and read slightly better, the floor being
   * darker. Every identity drawn after this rule clears 7:1 with no exception.
   */
  it.each(named)('%s reads a link, or is one of the two inherited identities', (name, palette) => {
    const ratio = contrast(palette.text.link.primary, palette.surface.secondary);
    expect(ratio).toBeGreaterThanOrEqual(INHERITED.some(i => name.startsWith(i)) ? 4 : 7);
  });
});

describe('the identity compiled into the APK', () => {
  it('states the hex colors.xml has to mirror', () => {
    const identity = themes[defaultThemeName];
    expect(ColorTool.to.hex(identity.surface.primary)).toBe('#0F1A21');
    expect(ColorTool.to.hex(identity.button.primary)).toBe('#38BDC7');
  });
});

describe('the default theme', () => {
  // A spot-check that the grammar holds where it is easiest to get wrong: `primary` is the
  // canonical case of its parent, so body copy and the screen heading are *different* colours.
  it('separates ordinary body copy from the screen heading', () => {
    expect(colors.text.primary).not.toBe(colors.text.title.primary);
  });

  it('types as ThemeColors', () => {
    const typed: ThemeColors = colors;
    expect(typed.text.label).toBeDefined();
  });
});
