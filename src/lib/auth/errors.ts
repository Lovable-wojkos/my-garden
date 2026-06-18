export function signInErrorRedirect(message: string): string {
  return `/auth/signin?error=${encodeURIComponent(message)}`;
}

export function logAuthError(context: string, error: unknown): void {
  console.error(`[auth:${context}]`, error);
}
