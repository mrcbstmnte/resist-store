import { describe, expect, it } from 'vitest';
import { parseDirection, parseSort, sortCatalog } from '@/lib/catalog';

const items = [
  { name: 'Tote Bag — Green', priceCents: 45000, silhouette: 'bag' as const },
  { name: '5-Panel Cap — Purple', priceCents: 65000, silhouette: 'cap' as const },
  { name: 'slow Pace Club Tee — Grey', priceCents: 89000, silhouette: 'tee' as const },
  { name: 'Endurance Division Tee — Black', priceCents: 89000, silhouette: 'tee' as const },
  { name: '5-Panel Cap — Green', priceCents: 65000, silhouette: 'cap' as const },
];
const names = (sort: Parameters<typeof sortCatalog>[1], dir?: Parameters<typeof sortCatalog>[2]) =>
  sortCatalog(items, sort, dir).map((p) => p.name);

describe('sortCatalog', () => {
  it('groups by category (tees, then caps, then bags), name A–Z within each', () => {
    expect(names('category')).toEqual([
      'Endurance Division Tee — Black',
      'slow Pace Club Tee — Grey',
      '5-Panel Cap — Green',
      '5-Panel Cap — Purple',
      'Tote Bag — Green',
    ]);
  });

  it('sorts by name ignoring case', () => {
    expect(names('name')).toEqual([
      '5-Panel Cap — Green',
      '5-Panel Cap — Purple',
      'Endurance Division Tee — Black',
      'slow Pace Club Tee — Grey',
      'Tote Bag — Green',
    ]);
  });

  it('sorts by price low to high, same price by name', () => {
    expect(names('price')).toEqual([
      'Tote Bag — Green',
      '5-Panel Cap — Green',
      '5-Panel Cap — Purple',
      'Endurance Division Tee — Black',
      'slow Pace Club Tee — Grey',
    ]);
  });

  it('flips each sort when descending, keeping ties A–Z', () => {
    expect(names('name', 'desc')).toEqual([
      'Tote Bag — Green',
      'slow Pace Club Tee — Grey',
      'Endurance Division Tee — Black',
      '5-Panel Cap — Purple',
      '5-Panel Cap — Green',
    ]);
    expect(names('price', 'desc')).toEqual([
      'Endurance Division Tee — Black',
      'slow Pace Club Tee — Grey',
      '5-Panel Cap — Green',
      '5-Panel Cap — Purple',
      'Tote Bag — Green',
    ]);
    expect(names('category', 'desc')).toEqual([
      'Tote Bag — Green',
      '5-Panel Cap — Green',
      '5-Panel Cap — Purple',
      'Endurance Division Tee — Black',
      'slow Pace Club Tee — Grey',
    ]);
  });

  it('leaves the original list alone', () => {
    const before = items.map((p) => p.name);
    sortCatalog(items, 'name');
    expect(items.map((p) => p.name)).toEqual(before);
  });
});

describe('parseSort', () => {
  it('defaults to category for missing or unknown values', () => {
    expect(parseSort(undefined)).toBe('category');
    expect(parseSort('popularity')).toBe('category');
    expect(parseSort(['price', 'name'])).toBe('category');
    expect(parseSort('price')).toBe('price');
  });
});

describe('parseDirection', () => {
  it('is ascending unless the URL says desc', () => {
    expect(parseDirection(undefined)).toBe('asc');
    expect(parseDirection('up')).toBe('asc');
    expect(parseDirection('desc')).toBe('desc');
  });
});
