import { redirect } from '@/i18n/navigation';

/** Unknown paths (e.g. /de → /sl/de) go back to the home page of the locale. */
export default async function CatchAll({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/', locale });
}
