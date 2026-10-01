/**
 * Client-side email check for the sign-in form. Deliberately permissive — it
 * only catches addresses that are clearly malformed; the auth provider does
 * the real validation when the link is sent.
 *
 * Returns a short, specific hint describing what's wrong, or null when the
 * address looks valid (or is empty — an empty field isn't an error yet).
 */
export function getEmailProblem(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/\s/.test(value)) return "Email addresses can't contain spaces.";

  const atCount = value.split('@').length - 1;
  if (atCount === 0) return 'Your email is missing an "@".';
  if (atCount > 1) return 'Your email should have only one "@".';

  const [local, domain] = value.split('@');
  if (!local) return 'Add the part before the "@".';
  if (!domain) return 'Add the part after the "@", like gmail.com.';
  if (domain.startsWith('.') || domain.includes('..')) {
    return 'Check the part after the "@" — it has an extra dot.';
  }

  const labels = domain.split('.');
  const tld = labels[labels.length - 1];
  if (labels.length < 2) return `Add the ending, like ${domain}.com.`;
  if (tld.length < 2) return 'Finish the ending, like .com or .co.';
  if (!/^[a-z0-9-]+$/i.test(tld) || labels.some((label) => !label)) {
    return 'Enter a valid email, like name@example.com.';
  }

  return null;
}

export function isValidEmail(input: string): boolean {
  return input.trim().length > 0 && getEmailProblem(input) === null;
}
