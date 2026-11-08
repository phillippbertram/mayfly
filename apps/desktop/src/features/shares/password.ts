/** Same limit as Rust; Rust checks again. */
export const MAX_PASSWORD_CHARS = 128;

/** Why a password can't be used, or `null`. Rust applies the same rules. */
export function passwordProblem(password: string): string | null {
  if (!password.trim()) return "Enter a password or generate one.";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point.
  if (/[\u0000-\u001f\u007f]/.test(password)) return "Remove line breaks and control characters.";
  if ([...password].length > MAX_PASSWORD_CHARS)
    return `Keep the password under ${MAX_PASSWORD_CHARS} characters.`;
  return null;
}
