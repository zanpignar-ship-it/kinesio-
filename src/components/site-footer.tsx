import { Globe } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export async function SiteFooter() {
  const t = await getTranslations('common');
  const tl = await getTranslations('legal');
  const current = await getLocale();
  return (
    <footer className="site-footer border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 text-sm sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-foreground flex items-center gap-2 font-semibold tracking-wide">
            <LogoMark className="size-6" />
            {t('appName')}
          </span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              {tl('terms')}
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {tl('privacy')}
            </Link>
          </nav>
        </div>
        <p data-testid="disclaimer" className="max-w-3xl text-xs leading-relaxed">
          {t('disclaimer')}
        </p>
        <nav aria-label={t('language')} className="flex flex-wrap items-center gap-1">
          <Globe className="mr-1 size-4" aria-hidden />
          {routing.locales.map((locale) => (
            <Link
              key={locale}
              href="/"
              locale={locale}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-muted hover:text-foreground',
                locale === current && 'bg-secondary text-secondary-foreground font-semibold',
              )}
            >
              {t(`localeNames.${locale}`)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
