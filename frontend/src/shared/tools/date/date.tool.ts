import type { Strings } from '../../i18n';

// DateTool — generic, domain-agnostic date handling. Knows nothing about Series/Chapter/etc.
// The one place the app parses/normalizes/formats a date string, so a provider quirk (e.g.
// Kavita's *Utc fields: an ISO-8601 local date-time with NO timezone offset and a 7-digit
// fraction of a second — "2026-07-30T02:04:27.9142132" — which JS Date.parse in Hermes rejects)
// is corrected in exactly one spot.
//
// `parse.*` goes FROM a raw string; `format.*` goes TO a presentational form.

// How a date can be drawn. 'LANGUAGE' follows the app language (day first in Portuguese, month
// first otherwise); the rest are fixed shapes the user can pick; 'RELATIVE' is "há 3 d" up to 30 days, then a plain date.
export const DATE_STYLES = ['LANGUAGE', 'DMY', 'MDY', 'YMD', 'DMY_SHORT', 'RELATIVE'] as const;
export type DateStyle = (typeof DATE_STYLES)[number];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// 'RELATIVE' stops reading "há 45 d" past this age and falls back to the language's calendar date.
const RELATIVE_LIMIT_MS = 30 * DAY_MS;

// A raw provider date string → a well-formed ISO-UTC string (…SSS'Z'), or undefined when it
// can't be understood. Handles Kavita's shape: an ISO local date-time, no zone, with a
// variable-precision fraction ("2026-07-30T02:04:27.9142132") — clamp the fraction to
// milliseconds and append the "Z" the value's own field name ("…Utc") implies. A value that
// already carries a zone (…Z or …±hh:mm) is trusted as-is.
function rawToIsoUtc(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  // Already carries a zone (…Z or …±hh:mm) → trust it.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    return trimmed;
  }
  // The known zone-less shape (Kavita's *Utc fields) → clamp the fraction to ms, add the Z.
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/);
  if (m) {
    const [, base, frac] = m;
    const millis = (frac ?? '').slice(0, 3).padEnd(3, '0');
    return `${base}.${millis}Z`;
  }
  // Anything else is an unexpected shape from the provider — loud, but non-fatal.
  console.warn(`DateTool: unrecognized date format, ignoring: ${JSON.stringify(input)}`);
  return undefined;
}

export const DateTool = {
  // parse.* takes a raw provider date string (any shape Kavita hands us) and converts it TO the
  // requested representation.
  parse: {
    to: {
      // → epoch ms. undefined when the input is missing or can't be understood.
      epochMs(input: string | undefined): number | undefined {
        const iso = rawToIsoUtc(input);
        if (!iso) {
          return undefined;
        }
        const ms = Date.parse(iso);
        return Number.isNaN(ms) ? undefined : ms;
      },

      // → a well-formed ISO-UTC string (…SSS'Z'). undefined when the input is missing or can't
      // be understood.
      iso(input: string | undefined): string | undefined {
        return rawToIsoUtc(input);
      },
    },

    // Whether a raw provider date string can be understood.
    isValid(input: string | undefined): boolean {
      return DateTool.parse.to.epochMs(input) !== undefined;
    },
  },

  // format.* takes the app's internal representation (epoch ms) and produces a presentational
  // form.
  format: {
    to: {
      // → a well-formed ISO-UTC string.
      utcIso(epochMs: number): string {
        return new Date(epochMs).toISOString();
      },

      // → "HH:MM:SS" in the device's local zone. For a wall-clock timestamp the user reads at a
      // glance ("Atualizado às 14:30:51"), never for storage or comparison.
      time(epochMs: number): string {
        const d = new Date(epochMs);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },

      // → "DD/MM/YYYY HH:MM" in the device's local zone — the exact-timestamp counterpart of
      // relative() above, for a detail view where "há 2 h" isn't precise enough.
      full(epochMs: number): string {
        const d = new Date(epochMs);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      },

      // → a calendar date in the device's local zone, in the shape `style` names. `language` only
      // matters for 'LANGUAGE'; `t` only for 'RELATIVE' (this tool has no language context).
      date({ epochMs, style, language, t }: { epochMs: number; style: DateStyle; language: string; t: Strings }): string {
        const d = new Date(epochMs);
        const pad = (n: number) => String(n).padStart(2, '0');
        const [day, month, year] = [pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear()];
        // Too old for "há N d" to be useful → the same calendar date 'LANGUAGE' would draw.
        const tooOld = style === 'RELATIVE' && Date.now() - epochMs >= RELATIVE_LIMIT_MS;
        const resolved = style === 'LANGUAGE' || tooOld ? (language.toLowerCase().startsWith('pt') ? 'DMY' : 'MDY') : style;
        switch (resolved) {
          case 'DMY':
            return `${day}/${month}/${year}`;
          case 'MDY':
            return `${month}/${day}/${year}`;
          case 'YMD':
            return `${year}-${month}-${day}`;
          case 'DMY_SHORT':
            return `${day}/${month}/${String(year).slice(-2)}`;
          default:
            return DateTool.format.to.relative(epochMs, t);
        }
      },

      // → "agora" / "há 5 min" / "há 2 h" / "há 3 d". `t` is injected (this tool is pure, no
      // language context). A future timestamp (clock skew) reads as "agora".
      relative(epochMs: number, t: Strings): string {
        const delta = Date.now() - epochMs;
        if (delta < MINUTE_MS) {
          return t.dateJustNow;
        }
        if (delta < HOUR_MS) {
          return t.dateMinutesAgo.replace('{0}', String(Math.floor(delta / MINUTE_MS)));
        }
        if (delta < DAY_MS) {
          return t.dateHoursAgo.replace('{0}', String(Math.floor(delta / HOUR_MS)));
        }
        return t.dateDaysAgo.replace('{0}', String(Math.floor(delta / DAY_MS)));
      },
    },
  },
};
