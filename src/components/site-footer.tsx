import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export async function SiteFooter() {
  const t = await getTranslations('common');
  const tl = await getTranslations('legal');
  const current = await getLocale();
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 text-sm">
        <p data-testid="disclaimer">{t('disclaimer')}</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms" className="underline-offset-4 hover:underline">
            {tl('terms')}
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            {tl('privacy')}
          </Link>
        </nav>
        <nav aria-label={t('language')} className="flex flex-wrap gap-x-4 gap-y-2">
          {routing.locales.map((locale) => (
            <Link
              key={locale}
              href="/"
              locale={locale}
              className={cn('underline-offset-4 hover:underline', locale === current && 'text-foreground font-semibold')}
            >
              {t(`localeNames.${locale}`)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
