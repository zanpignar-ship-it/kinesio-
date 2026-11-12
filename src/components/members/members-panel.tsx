import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { removeMember, revokeInvitation, setMemberRole } from '@/app/[locale]/app/settings/member-actions';
import { listInvitations, listMembers } from '@/lib/members/queries';
import { InviteForm } from './invite-form';

type Props = { organizationId: string; currentUserId: string; isOwner: boolean };

export async function MembersPanel({ organizationId, currentUserId, isOwner }: Props) {
  const t = await getTranslations('members');
  const locale = await getLocale();
  const format = await getFormatter();
  const [members, invitations] = await Promise.all([listMembers(organizationId), isOwner ? listInvitations(organizationId) : Promise.resolve([])]);
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col divide-y" data-testid="members">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {m.email}
              {m.user_id === currentUserId ? <span className="text-muted-foreground"> ({t('you')})</span> : null}
            </span>
            {isOwner ? (
              <form action={setMemberRole} className="flex items-center gap-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="userId" value={m.user_id} />
                <input type="hidden" name="role" value={m.role === 'owner' ? 'member' : 'owner'} />
                <span className="font-medium">{t(`roles.${m.role}`)}</span>
                <Button type="submit" variant="ghost" size="sm">
                  {m.role === 'owner' ? t('makeMember') : t('makeOwner')}
                </Button>
              </form>
            ) : (
              <span className="font-medium">{t(`roles.${m.role}`)}</span>
            )}
            {isOwner && m.user_id !== currentUserId ? (
              <form action={removeMember}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="userId" value={m.user_id} />
                <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                  {t('remove')}
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">{t('inviteTitle')}</h3>
            <p className="text-muted-foreground text-sm">{t('inviteHint')}</p>
            <InviteForm />
          </div>
          {invitations.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">{t('pending')}</h3>
              <ul className="flex flex-col divide-y text-sm">
                {invitations.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <span className="text-muted-foreground">
                      {t(`roles.${i.role}`)} · {t('expires', { date: format.dateTime(new Date(i.expires_at), { dateStyle: 'medium' }) })}
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={i.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t('revoke')}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
