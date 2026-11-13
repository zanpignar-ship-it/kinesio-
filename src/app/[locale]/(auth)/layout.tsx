import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';

/** Split screen: the form on the left, a calm brand panel with the three promises on the right. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  const points = t.raw('auth.panel.points') as string[];
  return (
    <div className="grid min-h-[calc(100dvh-1px)] lg:grid-cols-2">
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link href="/" className="text-primary flex items-center gap-2 self-start font-semibold tracking-wide">
          <LogoMark className="size-8" />
          {t('common.appName')}
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10">{children}</div>
      </main>
      <aside className="bg-sidebar relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-end lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(60% 50% at 80% 10%, oklch(0.55 0.12 156 / 0.55), transparent 70%), radial-gradient(50% 40% at 10% 90%, oklch(0.5 0.1 120 / 0.35), transparent 70%)',
          }}
        />
        <svg aria-hidden viewBox="0 0 400 400" className="absolute -top-10 -right-16 w-[28rem] text-white/[0.06]">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx="200" cy="200" r={30 + i * 22} fill="none" stroke="currentColor" strokeWidth="2" />
          ))}
        </svg>
        <div className="relative flex max-w-md flex-col gap-6 text-white">
          <p className="text-3xl leading-tight font-semibold tracking-tight">{t('auth.panel.title')}</p>
          <ul className="flex flex-col gap-3">
            {points.map((p) => (
              <li key={p} className="flex gap-3 text-emerald-50/90">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
