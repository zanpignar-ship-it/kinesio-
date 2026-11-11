import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const common = await getTranslations('common');
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <p className="text-primary text-sm font-semibold tracking-wide uppercase">{common('appName')}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
      <p className="text-muted-foreground mt-4 text-lg">{t('subtitle')}</p>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('deadlineLarge')}</CardTitle>
          <CardDescription>{t('deadlineSmall')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{t('comingSoon')}</p>
        </CardContent>
      </Card>
    </main>
  );
}
