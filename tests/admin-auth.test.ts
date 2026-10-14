import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminAuthorization, isAdminConfigured } from '@/lib/admin-auth';

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

afterEach(() => vi.unstubAllEnvs());

describe('admin login', () => {
  it('accepts the right username and password, rejects anything else', () => {
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', 'correct horse');
    expect(isAdminAuthorization(basic('admin', 'correct horse'))).toBe(true);
    expect(isAdminAuthorization(basic('admin', 'wrong'))).toBe(false);
    expect(isAdminAuthorization(basic('Admin', 'correct horse'))).toBe(false);
    expect(isAdminAuthorization(null)).toBe(false);
  });

  it('ignores stray spaces and newlines pasted into the settings', () => {
    vi.stubEnv('ADMIN_USERNAME', ' admin\n');
    vi.stubEnv('ADMIN_PASSWORD', 'secret \n');
    expect(isAdminAuthorization(basic('admin', 'secret'))).toBe(true);
  });

  it('reports when login is not configured', () => {
    vi.stubEnv('ADMIN_USERNAME', 'admin');
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(isAdminConfigured()).toBe(false);
    expect(isAdminAuthorization(basic('admin', ''))).toBe(false);
  });
});
