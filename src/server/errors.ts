/** Errors whose message is safe to show to end users (already localized key). */
export class DomainError extends Error {
  constructor(public readonly code: string, message?: string, public readonly details?: Record<string, unknown>) {
    super(message ?? code);
    this.name = "DomainError";
  }
}
export class AuthError extends DomainError {
  constructor(code = "auth.required") {
    super(code);
    this.name = "AuthError";
  }
}
export class ForbiddenError extends DomainError {
  constructor(code = "auth.forbidden") {
    super(code);
    this.name = "ForbiddenError";
  }
}
