/**
 * Financial + refund calculation tests.
 * Run with:  npm --workspace server run test
 * (Node's built-in test runner via tsx — no extra dependencies.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commissionFor, computeRefund } from '../src/lib/calc.js';

test('commission is ₹50 per person', () => {
  assert.equal(commissionFor(1), 50);
  assert.equal(commissionFor(3), 150);
  assert.equal(commissionFor(10), 500);
});

test('commission respects a custom per-person rate', () => {
  assert.equal(commissionFor(4, 75), 300);
});

test('commission never goes negative and ignores fractional persons', () => {
  assert.equal(commissionFor(-2), 0);
  assert.equal(commissionFor(2.9), 100);
});

test('refund is 100% when cancelled 7+ days before the trek', () => {
  const r = computeRefund('2026-07-20', '2026-07-10', 1725); // 10 days before
  assert.equal(r.daysBefore, 10);
  assert.equal(r.percent, 100);
  assert.equal(r.amount, 1725);
});

test('refund is exactly 100% at the 7-day boundary', () => {
  const r = computeRefund('2026-07-20', '2026-07-13', 1000); // 7 days
  assert.equal(r.percent, 100);
  assert.equal(r.amount, 1000);
});

test('refund is 50% when cancelled 4–6 days before', () => {
  const r = computeRefund('2026-07-20', '2026-07-15', 1000); // 5 days
  assert.equal(r.percent, 50);
  assert.equal(r.amount, 500);
});

test('refund is 50% at the 4-day boundary', () => {
  const r = computeRefund('2026-07-20', '2026-07-16', 800); // 4 days
  assert.equal(r.percent, 50);
  assert.equal(r.amount, 400);
});

test('refund is 0% when cancelled under 4 days before', () => {
  const r = computeRefund('2026-07-20', '2026-07-18', 1000); // 2 days
  assert.equal(r.percent, 0);
  assert.equal(r.amount, 0);
});

test('expected refund date is cancellation date + 30 days', () => {
  const r = computeRefund('2026-07-20', '2026-07-01', 500);
  assert.equal(r.expectedRefundDate, '2026-07-31');
});
