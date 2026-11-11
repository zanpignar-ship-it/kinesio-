/** Only same-site relative paths are allowed after sign-in (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

export type HomePath = '/login' | '/onboarding' | '/app';

/** Where a visitor belongs, given whether they are signed in and how many organizations they have. */
export function homeFor(state: { signedIn: boolean; orgCount: number }): HomePath {
  if (!state.signedIn) return '/login';
  return state.orgCount === 0 ? '/onboarding' : '/app';
}
