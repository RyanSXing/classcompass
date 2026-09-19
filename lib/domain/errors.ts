export class DomainError extends Error {
  constructor(public code: string, public status: number, message: string, public fieldErrors?: Record<string, string[]>) { super(message); this.name = 'DomainError'; }
}
export function invariant(condition: unknown, code: string, message: string, status = 422): asserts condition { if (!condition) throw new DomainError(code, status, message); }
