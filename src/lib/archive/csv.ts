/** CSV for Excel in Slovenia/Croatia/Serbia/BiH: semicolon separator, comma decimals, CRLF, UTF-8 with BOM. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    // Comma decimals: Slovenian/Croatian/Serbian Excel would read "2.5" as a date.
    if (typeof v === 'number') return String(v).replace('.', ',');
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Text from other people's files must not run as a formula when the CSV is opened.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(';'), ...rows.map((r) => columns.map((c) => cell(r[c])).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
