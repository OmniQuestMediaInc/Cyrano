// services/creator-onboarding/src/email-domain.policy.spec.ts
import { checkEmailDomain } from './email-domain.policy';

describe('checkEmailDomain', () => {
  it.each([
    ['model@studio.example', true],
    ['ANY@MODELHUB.EXAMPLE', true],
    ['user@mail.studio.example', true], // subdomain match
    ['user@creator-studio.example', true],
  ])('blocks studio domain %s', (email, expected) => {
    const r = checkEmailDomain(email);
    expect(r.blocked).toBe(expected);
    expect(r.reason).toBe('STUDIO_DOMAIN_BLOCKED');
  });

  it.each([
    ['indie@gmail.com', false],
    ['model@protonmail.com', false],
    ['User@Outlook.COM', false],
  ])('allows non-studio domain %s', (email, expected) => {
    const r = checkEmailDomain(email);
    expect(r.blocked).toBe(expected);
    expect(r.reason).toBe(null);
  });

  it.each([
    ['', 'INVALID_EMAIL'],
    ['no-at-sign', 'INVALID_EMAIL'],
    ['user@', 'INVALID_EMAIL'],
  ])('flags %s as invalid', (email, reason) => {
    const r = checkEmailDomain(email);
    expect(r.blocked).toBe(false);
    expect(r.reason).toBe(reason);
  });
});
