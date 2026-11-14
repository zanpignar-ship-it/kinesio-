import { cn } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ENTITIES, type Entity } from '@/lib/masterdata/config';

export async function MasterDataTabs({ active }: { active: Entity }) {
  const t = await getTranslations('md');
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {ENTITIES.map((e) => (
        <Link
          key={e}
          href={`/app/master-data/${e}`}
          aria-current={e === active ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            e === active ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground border-transparent',
          )}
        >
          {t(e)}
        </Link>
      ))}
    </nav>
  );
}
