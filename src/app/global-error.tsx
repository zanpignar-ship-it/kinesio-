'use client';

// Rendered outside the localized layout (no translations available), so the text is fixed and bilingual.
const TEXT = {
  title: 'Prišlo je do napake · Something went wrong',
  body: 'Poskusite znova čez trenutek. · Please try again in a moment.',
  retry: 'Poskusi znova · Try again',
};

/** Last-resort error page. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="sl">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '64px auto', padding: '0 16px' }}>
        <h1>{TEXT.title}</h1>
        <p>{TEXT.body}</p>
        <button type="button" onClick={() => reset()} style={{ padding: '8px 16px' }}>
          {TEXT.retry}
        </button>
      </body>
    </html>
  );
}
