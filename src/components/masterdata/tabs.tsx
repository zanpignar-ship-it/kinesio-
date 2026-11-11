import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ENTITIES, type Entity } from '@/lib/masterdata/config';
import { cn } from '@/lib/utils';

export async function MasterDataTabs({ active }: { active: Entity }) {
  const t = await getTranslations('md');
  return (
    <nav className="flex flex-wrap gap-2">
      {ENTITIES.map((e) => (
        <Link key={e} href={`/app/master-data/${e}`} className={cn('rounded-full border px-3 py-1.5 text-sm', e === active && 'bg-foreground text-background')}>
          {t(e)}
        </Link>
      ))}
    </nav>
  );
}
