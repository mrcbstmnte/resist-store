import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminConfigError, adminFromAuthorization, isAdminAuthorization, isAdminConfigured } from '@/lib/admin-auth';

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const admins = (users: string, passes: string) => {
  vi.stubEnv('ADMIN_USERNAME', users);
  vi.stubEnv('ADMIN_PASSWORD', passes);
};

afterEach(() => vi.unstubAllEnvs());

describe('admin login', () => {
  it('accepts the right username and password, rejects anything else', () => {
    admins('admin', 'correct horse');
    expect(isAdminAuthorization(basic('admin', 'correct horse'))).toBe(true);
    expect(isAdminAuthorization(basic('admin', 'wrong'))).toBe(false);
    expect(isAdminAuthorization(basic('Admin', 'correct horse'))).toBe(false);
    expect(isAdminAuthorization(null)).toBe(false);
  });

  it('ignores stray spaces and newlines pasted into the settings', () => {
    admins(' admin\n', 'secret \n');
    expect(isAdminAuthorization(basic('admin', 'secret'))).toBe(true);
  });

  it('reports when login is not configured', () => {
    admins('admin', '');
    expect(isAdminConfigured()).toBe(false);
    expect(isAdminAuthorization(basic('admin', ''))).toBe(false);
  });
});

describe('several admins', () => {
  it('pairs usernames and passwords by position and says who logged in', () => {
    admins('ana, ben ,carlo', 'ana-pass,ben pass, carlo-pass');
    expect(isAdminConfigured()).toBe(true);
    expect(adminFromAuthorization(basic('ana', 'ana-pass'))).toBe('ana');
    expect(adminFromAuthorization(basic('ben', 'ben pass'))).toBe('ben');
    expect(adminFromAuthorization(basic('carlo', 'carlo-pass'))).toBe('carlo');
  });

  it("rejects one admin's username with another admin's password", () => {
    admins('ana,ben', 'ana-pass,ben-pass');
    expect(adminFromAuthorization(basic('ana', 'ben-pass'))).toBeNull();
    expect(adminFromAuthorization(basic('ben', 'ana-pass'))).toBeNull();
  });

  it('refuses everyone when the lists have different lengths', () => {
    admins('ana,ben', 'ana-pass');
    expect(adminConfigError()).toMatch(/2 names but ADMIN_PASSWORD lists 1 password/);
    expect(adminFromAuthorization(basic('ana', 'ana-pass'))).toBeNull();
  });

  it('refuses everyone when an entry is blank or a name repeats', () => {
    admins('ana,,ben', 'a,b,c');
    expect(adminConfigError()).toMatch(/empty entry/);
    admins('ana,ben,', 'a,b,c');
    expect(adminConfigError()).toMatch(/empty entry/);
    admins('ana,ANA', 'a,b');
    expect(adminConfigError()).toMatch(/same name twice/);
    expect(adminFromAuthorization(basic('ana', 'a'))).toBeNull();
  });
});
