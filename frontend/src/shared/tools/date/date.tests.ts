import { DateTool } from './date.tool';
import { getStrings } from '../../i18n/strings';

const t = getStrings('pt-BR');

describe('DateTool.parse.to.iso', () => {
  it('adds the Z and clamps a long fraction on a zone-less Kavita value', () => {
    expect(DateTool.parse.to.iso('2026-07-30T02:04:27.9142132')).toBe('2026-07-30T02:04:27.914Z');
  });

  it('pads a short fraction to milliseconds', () => {
    expect(DateTool.parse.to.iso('2026-07-30T02:04:27.9')).toBe('2026-07-30T02:04:27.900Z');
  });

  it('adds .000Z when there is no fraction', () => {
    expect(DateTool.parse.to.iso('2026-07-30T02:04:27')).toBe('2026-07-30T02:04:27.000Z');
  });

  it('trusts a value that already ends in Z', () => {
    expect(DateTool.parse.to.iso('2026-07-30T02:04:27.914Z')).toBe('2026-07-30T02:04:27.914Z');
  });

  it('trusts a value that already carries an offset', () => {
    expect(DateTool.parse.to.iso('2026-07-30T02:04:27-03:00')).toBe('2026-07-30T02:04:27-03:00');
  });

  it('returns undefined for null / empty / whitespace', () => {
    expect(DateTool.parse.to.iso(undefined)).toBeUndefined();
    expect(DateTool.parse.to.iso('')).toBeUndefined();
    expect(DateTool.parse.to.iso('   ')).toBeUndefined();
  });

  it('warns and returns undefined for an unrecognized shape', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(DateTool.parse.to.iso('30/07/2026')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('DateTool.parse.to.epochMs', () => {
  it('parses a zone-less 7-digit-fraction Kavita value (Hermes Date.parse would NaN this raw)', () => {
    const ms = DateTool.parse.to.epochMs('2026-07-30T02:04:27.9142132');
    expect(ms).toBe(Date.parse('2026-07-30T02:04:27.914Z'));
  });

  it('returns undefined for missing / unrecognized input', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(DateTool.parse.to.epochMs(undefined)).toBeUndefined();
    expect(DateTool.parse.to.epochMs('nope')).toBeUndefined();
    warn.mockRestore();
  });
});

describe('DateTool.parse.isValid', () => {
  it('true for a parseable value, false otherwise', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(DateTool.parse.isValid('2026-07-30T02:04:27.9142132')).toBe(true);
    expect(DateTool.parse.isValid(undefined)).toBe(false);
    expect(DateTool.parse.isValid('garbage')).toBe(false);
    warn.mockRestore();
  });
});

describe('DateTool.format.to.utcIso', () => {
  it('epoch ms → ISO-UTC', () => {
    const ms = Date.parse('2026-07-30T02:04:27.914Z');
    expect(DateTool.format.to.utcIso(ms)).toBe('2026-07-30T02:04:27.914Z');
  });
});

describe('DateTool.format.to.time', () => {
  it('epoch ms → local "HH:MM:SS", zero-padded', () => {
    const d = new Date(2026, 6, 30, 4, 5, 9);
    expect(DateTool.format.to.time(d.getTime())).toBe('04:05:09');
  });
});

describe('DateTool.format.to.relative', () => {
  const NOW = 1_800_000_000_000;
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  it('"agora" under a minute (and for a future timestamp)', () => {
    expect(DateTool.format.to.relative(NOW - 30_000, t)).toBe('agora');
    expect(DateTool.format.to.relative(NOW + 10_000, t)).toBe('agora');
  });

  it('minutes', () => {
    expect(DateTool.format.to.relative(NOW - 5 * 60_000, t)).toBe('há 5 minuto(s)');
  });

  it('hours', () => {
    expect(DateTool.format.to.relative(NOW - 3 * 3_600_000, t)).toBe('há 3 hora(s)');
  });

  it('days', () => {
    expect(DateTool.format.to.relative(NOW - 2 * 86_400_000, t)).toBe('há 2 dia(s)');
  });
});

describe('DateTool.format.to.date', () => {
  const epochMs = new Date(2026, 10, 8, 12).getTime();
  const render = (style: Parameters<typeof DateTool.format.to.date>[0]['style'], language = 'pt-BR') =>
    DateTool.format.to.date({ epochMs, style, language, t });

  it('draws each fixed shape', () => {
    expect(render('DMY')).toBe('08/11/2026');
    expect(render('MDY')).toBe('11/08/2026');
    expect(render('YMD')).toBe('2026-11-08');
    expect(render('DMY_SHORT')).toBe('08/11/26');
  });

  it('LANGUAGE puts the day first in Portuguese and the month first otherwise', () => {
    expect(render('LANGUAGE', 'pt-BR')).toBe('08/11/2026');
    expect(render('LANGUAGE', 'en')).toBe('11/08/2026');
  });

  it('RELATIVE reads as time elapsed', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    expect(DateTool.format.to.date({ epochMs: threeDaysAgo, style: 'RELATIVE', language: 'pt-BR', t })).toBe(t.dateDaysAgo.replace('{0}', '3'));
  });

  it('RELATIVE still reads as time elapsed just under 30 days', () => {
    const day29 = Date.now() - 29 * 24 * 60 * 60 * 1000;
    expect(DateTool.format.to.date({ epochMs: day29, style: 'RELATIVE', language: 'pt-BR', t })).toBe(t.dateDaysAgo.replace('{0}', '29'));
  });

  it('RELATIVE falls back to the language date from 30 days on', () => {
    const old = Date.now() - 45 * 24 * 60 * 60 * 1000;
    const d = new Date(old);
    const pad = (n: number) => String(n).padStart(2, '0');
    const [day, month, year] = [pad(d.getDate()), pad(d.getMonth() + 1), d.getFullYear()];
    expect(DateTool.format.to.date({ epochMs: old, style: 'RELATIVE', language: 'pt-BR', t })).toBe(`${day}/${month}/${year}`);
    expect(DateTool.format.to.date({ epochMs: old, style: 'RELATIVE', language: 'en', t })).toBe(`${month}/${day}/${year}`);
  });
});
