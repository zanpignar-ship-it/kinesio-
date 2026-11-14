/** Escape text for XML element content and attribute values. */
export function esc(value: string | number): string {
  // Characters XML 1.0 does not allow are dropped (they would make the whole request invalid).
   
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** `<tag>escaped</tag>`, or '' when the value is null/undefined/'' (optional elements are simply left out). */
export function el(tag: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return `<${tag}>${esc(value)}</${tag}>`;
}

/** Text of the first element with this local name (any namespace prefix), unescaped; null when absent. */
export function pick(xml: string, localName: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${localName}>`).exec(xml);
  return m ? unesc(m[1]!.trim()) : null;
}

/** Inner XML of every element with this local name. */
export function pickAll(xml: string, localName: string): string[] {
  return [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${localName}>`, 'g'))].map((m) => m[1]!);
}

export function unesc(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}
