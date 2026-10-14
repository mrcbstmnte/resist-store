import { describe, expect, it } from 'vitest';
import { maskPrivateIds } from '@/lib/analytics-url';

describe('maskPrivateIds', () => {
  it('masks order ids in order and mock-payment pages', () => {
    expect(maskPrivateIds('https://resist.test/orders/7f3c2a1e-0000-4000-8000-000000000000')).toBe(
      'https://resist.test/orders/[id]',
    );
    expect(maskPrivateIds('https://resist.test/checkout/mock/7f3c2a1e')).toBe('https://resist.test/checkout/mock/[id]');
  });

  it('masks the order id in checkout return links', () => {
    expect(maskPrivateIds('https://resist.test/checkout/success?order=7f3c2a1e')).toBe(
      'https://resist.test/checkout/success?order=%5Bid%5D',
    );
  });

  it('leaves other pages alone', () => {
    for (const url of ['https://resist.test/', 'https://resist.test/products/tote-bag-green', 'https://resist.test/?sort=price&dir=desc', 'https://resist.test/orders']) {
      expect(maskPrivateIds(url)).toBe(url);
    }
  });
});
