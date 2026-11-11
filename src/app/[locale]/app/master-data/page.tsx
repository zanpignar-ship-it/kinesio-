import { redirect } from '@/i18n/navigation';

export default async function MasterDataIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/app/master-data/customers', locale });
}
