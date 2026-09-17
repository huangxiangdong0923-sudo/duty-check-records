import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, REASONS, getReasonsForSlot, getReasonByCode } from '../js/reasons.js';

test('reason codes are unique', () => {
  assert.equal(new Set(REASONS.map((reason) => reason.code)).size, REASONS.length);
});

test('slot lookup returns slot-specific and shared reasons', () => {
  const codes = getReasonsForSlot('morning').map((reason) => reason.code);
  assert.ok(codes.includes('floor-garbage-am'));
  assert.ok(codes.includes('other'));
  assert.ok(!codes.includes('eye-not-do'));
});

test('other reason requires a note', () => {
  assert.equal(getReasonByCode('other').requiresNote, true);
});

test('all slots have labels', () => {
  assert.deepEqual(SLOTS.map((slot) => slot.code), ['morning', 'afternoon', 'exercise', 'break', 'eye']);
});
