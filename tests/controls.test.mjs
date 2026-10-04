import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, CONTROL_ACTIONS, ACTION_LABELS, PAD_LABELS, keyLabel, rebind } from '../src/core/input.js';

test('keyLabel formats keyboard event codes into readable labels', () => {
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('KeyS'), 'S');
  assert.equal(keyLabel('KeyA'), 'A');
  assert.equal(keyLabel('KeyD'), 'D');
  assert.equal(keyLabel('ArrowUp'), 'UP');
  assert.equal(keyLabel('ArrowDown'), 'DOWN');
  assert.equal(keyLabel('ArrowLeft'), 'LEFT');
  assert.equal(keyLabel('ArrowRight'), 'RIGHT');
  assert.equal(keyLabel('Space'), 'SPACE');
  assert.equal(keyLabel('ShiftLeft'), 'SHIFT');
  assert.equal(keyLabel('ShiftRight'), 'SHIFT');
  assert.equal(keyLabel('ControlLeft'), 'CTRL');
  assert.equal(keyLabel('ControlRight'), 'CTRL');
  assert.equal(keyLabel('AltLeft'), 'ALT');
  assert.equal(keyLabel('Tab'), 'TAB');
  assert.equal(keyLabel('Escape'), 'ESC');
  assert.equal(keyLabel('Enter'), 'ENTER');
  assert.equal(keyLabel('Backspace'), 'BACKSPACE');
  assert.equal(keyLabel('Digit1'), '1');
  assert.equal(keyLabel('Digit9'), '9');
  assert.equal(keyLabel('Numpad5'), 'NUM 5');
  assert.equal(keyLabel(''), '--');
  assert.equal(keyLabel(/** @type {*} */ (null)), '--');
});

test('CONTROL_ACTIONS contains all configurable driving and menu actions', () => {
  const expected = [
    'throttle',
    'brake',
    'left',
    'right',
    'handbrake',
    'shiftUp',
    'shiftDown',
    'camera',
    'reset',
    'interact',
    'challenge',
    'map',
    'pause',
  ];
  for (const act of expected) {
    assert.ok(CONTROL_ACTIONS.includes(/** @type {*} */ (act)), `missing action ${act}`);
    assert.ok(ACTION_LABELS[act], `missing label for ${act}`);
    assert.ok(PAD_LABELS[act], `missing pad label for ${act}`);
    assert.ok(KEYS[act], `missing default keys for ${act}`);
  }
});

test('rebind assigns new key to action slot', () => {
  const initial = {
    throttle: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
  };
  const updated = rebind(initial, 'throttle', 0, 'KeyI');
  assert.equal(updated.throttle[0], 'KeyI');
  assert.equal(updated.throttle[1], 'ArrowUp');
  assert.equal(initial.throttle[0], 'KeyW', 'original map must not be mutated');
});

test('rebind refuses Escape, Enter, and NumpadEnter', () => {
  const initial = {
    throttle: ['KeyW', 'ArrowUp'],
  };
  assert.deepEqual(rebind(initial, 'throttle', 0, 'Escape'), initial);
  assert.deepEqual(rebind(initial, 'throttle', 0, 'Enter'), initial);
  assert.deepEqual(rebind(initial, 'throttle', 0, 'NumpadEnter'), initial);
});

test('rebind swaps duplicate keys when already assigned to another action', () => {
  const initial = {
    throttle: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
  };
  // Rebinding throttle slot 0 to KeyS (which is brake slot 0) should swap KeyW into brake slot 0
  const swapped = rebind(initial, 'throttle', 0, 'KeyS');
  assert.equal(swapped.throttle[0], 'KeyS');
  assert.equal(swapped.brake[0], 'KeyW');
  assert.equal(swapped.throttle[1], 'ArrowUp');
  assert.equal(swapped.brake[1], 'ArrowDown');
});

test('rebind swaps duplicate keys within the same action slots', () => {
  const initial = {
    throttle: ['KeyW', 'ArrowUp'],
  };
  const swapped = rebind(initial, 'throttle', 0, 'ArrowUp');
  assert.equal(swapped.throttle[0], 'ArrowUp');
  assert.equal(swapped.throttle[1], 'KeyW');
});

test('reset to defaults restores the original KEYS mapping', () => {
  let bindings = { ...KEYS };
  bindings = rebind(bindings, 'throttle', 0, 'KeyZ');
  assert.equal(bindings.throttle[0], 'KeyZ');
  // Reset
  const restored = {};
  for (const [k, v] of Object.entries(KEYS)) {
    restored[k] = [...v];
  }
  assert.deepEqual(restored.throttle, KEYS.throttle);
  assert.equal(restored.throttle[0], 'KeyW');
});
