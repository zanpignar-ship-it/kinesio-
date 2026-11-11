/** The organization chosen in the `lt_org` cookie if the user belongs to it, else the first one. */
export function pickOrganization<T extends { id: string }>(orgs: readonly T[], cookieValue: string | undefined): T | null {
  return orgs.find((o) => o.id === cookieValue) ?? orgs[0] ?? null;
}

export const ORG_COOKIE = 'lt_org';
