export class InvalidTransitionError extends Error {
  constructor(public readonly entity: string, public readonly from: string, public readonly to: string) {
    super(`Invalid ${entity} transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function defineMachine<S extends string>(entity: string, transitions: Record<S, readonly S[]>) {
  return {
    states: Object.keys(transitions) as S[],
    canTransition(from: S, to: S) {
      return transitions[from]?.includes(to) ?? false;
    },
    next(from: S): readonly S[] {
      return transitions[from] ?? [];
    },
    assert(from: S, to: S) {
      if (!transitions[from]?.includes(to)) throw new InvalidTransitionError(entity, from, to);
    },
    isTerminal(s: S) {
      return (transitions[s]?.length ?? 0) === 0;
    },
  };
}
