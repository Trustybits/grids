import { describe, expect, it } from 'vitest';
import { getEmailProblem, isValidEmail } from '../emailValidation';

describe('getEmailProblem', () => {
  it.each([
    'name@example.com',
    'first.last+tag@sub.example.co.uk',
    '  padded@example.io  ',
    'x@y.dev',
  ])('accepts %s', (email) => {
    expect(getEmailProblem(email)).toBeNull();
    expect(isValidEmail(email)).toBe(true);
  });

  it('treats an empty field as not-an-error but not valid', () => {
    expect(getEmailProblem('')).toBeNull();
    expect(getEmailProblem('   ')).toBeNull();
    expect(isValidEmail('')).toBe(false);
  });

  it.each([
    ['name example.com', /spaces/],
    ['name.example.com', /missing an "@"/],
    ['a@b@example.com', /only one "@"/],
    ['@example.com', /before the "@"/],
    ['name@', /after the "@"/],
    ['name@gmail', /like gmail\.com/],
    ['name@gmail.c', /Finish the ending/],
    ['name@.com', /extra dot/],
    ['name@gmail..com', /extra dot/],
    ['name@gmail.com.', /Finish the ending/],
    ['name@gmail.c0m!', /valid email/],
  ])('flags %s', (email, message) => {
    expect(getEmailProblem(email)).toMatch(message);
    expect(isValidEmail(email)).toBe(false);
  });
});
