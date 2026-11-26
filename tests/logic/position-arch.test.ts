import test from 'node:test';
import assert from 'node:assert/strict';
import { archSpans } from '../../src/components/Vault/PositionArch';

// The keystone holds 30 degrees at the crown; the stones tile the other 150.
const KEY = 30;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('an arch with no assumptions has no voussoirs to draw', () => {
  assert.deepEqual(archSpans(0), []);
  assert.deepEqual(archSpans(-2), []);
});

test('the stones tile exactly the arc the keystone leaves, at every count', () => {
  for (let n = 1; n <= 9; n++) {
    const covered = archSpans(n).reduce((sum, w) => sum + (w.from - w.to), 0);
    assert.ok(near(covered, 180 - KEY), `${n}: covered ${covered}, wanted ${180 - KEY}`);
  }
});

test('every assumption gets drawn, and only ever as one or two wedges', () => {
  for (let n = 1; n <= 9; n++) {
    const wedges = archSpans(n);
    for (let stone = 0; stone < n; stone++) {
      const mine = wedges.filter((w) => w.stone === stone);
      assert.ok(mine.length === 1 || mine.length === 2, `${n}/${stone}: ${mine.length} wedges`);
    }
    assert.equal(new Set(wedges.map((w) => w.stone)).size, n, `${n}: a stone went undrawn`);
  }
});

test('all assumptions carry the same width of arc', () => {
  for (let n = 1; n <= 9; n++) {
    const wedges = archSpans(n);
    const widths = Array.from({ length: n }, (_, stone) => wedges
      .filter((w) => w.stone === stone)
      .reduce((sum, w) => sum + (w.from - w.to), 0));
    for (const width of widths) assert.ok(near(width, (180 - KEY) / n), `${n}: uneven stone ${width}`);
  }
});

test('every wedge descends and stays inside the semicircle', () => {
  for (let n = 1; n <= 9; n++) {
    for (const { from, to } of archSpans(n)) {
      assert.ok(from > to, `${n}: a wedge must descend, got ${from} to ${to}`);
      assert.ok(from <= 180 + 1e-9 && to >= -1e-9, `${n}: ${from} to ${to} leaves the arc`);
    }
  }
});

test('wedges meet without gap or overlap, the keystone being the only break', () => {
  for (let n = 1; n <= 9; n++) {
    const wedges = [...archSpans(n)].sort((a, b) => b.from - a.from);
    assert.ok(near(wedges[0].from, 180), `${n}: the arch does not spring from the ground`);
    assert.ok(near(wedges[wedges.length - 1].to, 0), `${n}: the arch does not land`);
    for (let i = 1; i < wedges.length; i++) {
      const gap = wedges[i - 1].to - wedges[i].from;
      assert.ok(near(gap, 0) || near(gap, KEY), `${n}: wedges ${i - 1} and ${i} are ${gap} apart`);
    }
  }
});

test('no wedge crosses the crown the keystone occupies', () => {
  for (let n = 1; n <= 9; n++) {
    for (const { from, to } of archSpans(n)) {
      assert.ok(to >= 90 + KEY / 2 - 1e-9 || from <= 90 - KEY / 2 + 1e-9,
        `${n}: a wedge ${from}-${to} runs through the keystone`);
    }
  }
});

test('one assumption still closes the whole arch, as two springing wedges', () => {
  const wedges = archSpans(1);
  assert.equal(wedges.length, 2);
  assert.ok(wedges.every((w) => w.stone === 0));
  assert.ok(near(wedges[0].from, 180) && near(wedges[1].to, 0));
});
