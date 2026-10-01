export interface MailProviderLink {
  id: 'gmail' | 'outlook';
  label: string;
  url: string;
  iconClass: string;
}

const GMAIL: MailProviderLink = {
  id: 'gmail',
  label: 'Open Gmail',
  url: 'https://mail.google.com/mail/u/0/#inbox',
  iconClass: 'fab fa-google',
};

const OUTLOOK: MailProviderLink = {
  id: 'outlook',
  label: 'Open Outlook',
  url: 'https://outlook.live.com/mail/0/inbox',
  iconClass: 'fab fa-microsoft',
};

const OUTLOOK_DOMAINS = /^((outlook|hotmail|live)\.[a-z]{2,}(\.[a-z]{2,})?|msn\.com)$/;
// Consumer providers that are neither Gmail nor Outlook — we have no inbox
// link for these, so show nothing rather than a wrong guess.
const OTHER_CONSUMER_DOMAINS =
  /^(yahoo\.[a-z.]+|ymail\.com|icloud\.com|me\.com|mac\.com|aol\.com|proton\.me|protonmail\.com|pm\.me|gmx\.[a-z.]+|zoho\.com|yandex\.[a-z.]+|mail\.ru|fastmail\.com)$/;

/**
 * The single inbox shortcut to offer after sending a sign-in link. Microsoft
 * consumer addresses get Outlook; everything else (Gmail, and custom domains,
 * which are most often Google Workspace) gets Gmail.
 */
export function getMailProviderLink(email: string): MailProviderLink | null {
  const domain = email.trim().split('@').pop()?.toLowerCase() ?? '';
  if (!domain || !email.includes('@')) return null;
  if (OUTLOOK_DOMAINS.test(domain)) return OUTLOOK;
  if (OTHER_CONSUMER_DOMAINS.test(domain)) return null;
  return GMAIL;
}
