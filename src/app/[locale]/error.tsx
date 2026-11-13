'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/** Unexpected server or client error inside the app: a calm message, a retry and a way home. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errorPage');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('text')}</p>
      {error.digest ? <p className="text-muted-foreground text-xs">{t('code', { code: error.digest })}</p> : null}
      <div className="flex gap-3">
        <Button onClick={() => reset()}>{t('retry')}</Button>
        <Button asChild variant="outline">
          <Link href="/app">{t('home')}</Link>
        </Button>
      </div>
    </main>
  );
}
