import { z } from 'zod';

export const INVITATION_DAYS = 7;

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('members.errors.email').max(254, 'members.errors.email'),
  role: z.enum(['owner', 'member'], { message: 'members.errors.role' }),
});

/** Error hint from accept_invitation → translation key. */
export function acceptErrorKey(hint: string | undefined): string {
  if (hint === 'LT_INVITATION_EMAIL') return 'members.errors.otherEmail';
  if (hint === 'LT_INVITATION_INVALID') return 'members.errors.invalid';
  return 'members.errors.unknown';
}
