import { expect, it, vi } from 'vitest';

it('bounds concurrency and charges attempts even after release; resets each minute', async () => {
  vi.resetModules();
  const { reserveWalkingRequest: reserve } = await import('./request-budget');
  const first = reserve(900, 100_000)!;
  const second = reserve(900, 100_000)!;
  expect(reserve(1, 100_000)).toBeNull();
  first(); first(); // Release is idempotent.
  second();
  expect(reserve(1, 100_000)).toBeNull();
  const next = reserve(1, 160_000)!;
  expect(next).toBeTypeOf('function');
  next();
});
