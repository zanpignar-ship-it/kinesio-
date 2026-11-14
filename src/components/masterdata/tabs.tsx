import { chipClass } from '@/components/ui/page';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ENTITIES, type Entity } from '@/lib/masterdata/config';

export async function MasterDataTabs({ active }: { active: Entity }) {
  const t = await getTranslations('md');
  return (
    <nav className="flex flex-wrap gap-2">
      {ENTITIES.map((e) => (
        <Link key={e} href={`/app/master-data/${e}`} className={chipClass(Boolean(e === active))}>
          {t(e)}
        </Link>
      ))}
    </nav>
  );
}
