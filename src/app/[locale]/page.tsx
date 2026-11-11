import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const common = await getTranslations('common');
  const auth = await getTranslations('auth');
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">{auth('signUpTitle')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">{auth('signInTitle')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
