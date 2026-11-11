/** CSV for Excel in Slovenia/Croatia/Serbia/BiH: semicolon separator, CRLF, UTF-8 with BOM. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(';'), ...rows.map((r) => columns.map((c) => cell(r[c])).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
