import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoWorkspace } from '../../src/lib/demo-workspace';
import { sourceJourney } from '../../src/lib/source-journey';
import { soundingDepth } from '../../src/components/Library/SourceSounding';
import { archSpans } from '../../src/components/Vault/PositionArch';
import type { Media, VaultEntry } from '../../src/lib/types';

/**
 * The instruments read fields the app already stores. These run them over a
 * whole workspace rather than a hand-made fixture, so a record shape the
 * instruments cannot survive fails here instead of in the browser.
 */
const workspace = buildDemoWorkspace('test-uid');
const sources = workspace.media as Media[];
const positions = workspace.vault as VaultEntry[];

test('the workspace has records to read, or these tests prove nothing', () => {
  assert.ok(sources.length > 0, 'no sources');
  assert.ok(positions.length > 0, 'no positions');
});

test('the sounding survives every source in the workspace', () => {
  for (const source of sources) {
    const depth = soundingDepth(sourceJourney(source, 0));
    assert.ok(Number.isFinite(depth), `${source.title}: depth was ${depth}`);
    assert.ok(depth >= 0 && depth <= 4, `${source.title}: depth ${depth} is off the line`);
  }
});

test('citations move the sounding without ever taking it off the line', () => {
  for (const source of sources) {
    for (const citations of [0, 1, 5, 99]) {
      const depth = soundingDepth(sourceJourney(source, citations));
      assert.ok(depth >= 0 && depth <= 4, `${source.title} @${citations}: ${depth}`);
    }
  }
});

test('a source with nothing recorded reads as nothing, not as a broken gauge', () => {
  const bare = { id: 'x', title: 'Untouched', type: 'book', status: 'Queued',
    tags: [], annotations: [], dateAdded: '2026-01-01' } as unknown as Media;
  const state = sourceJourney(bare, 0);
  assert.equal(soundingDepth(state), 0);
  for (const step of ['overview', 'capture', 'annotations', 'connections'] as const) {
    assert.ok(state[step].next.length > 0, `${step} gave no next move`);
  }
});

test('the arch draws for every position in the workspace, assumptions or not', () => {
  for (const position of positions) {
    const count = (position.assumptions || []).map((a) => a.trim()).filter(Boolean).length;
    const wedges = archSpans(count);
    if (count === 0) { assert.equal(wedges.length, 0, `${position.title}: drew stones from nothing`); continue; }
    const covered = wedges.reduce((sum, w) => sum + (w.from - w.to), 0);
    assert.ok(Math.abs(covered - 150) < 1e-9, `${position.title}: arch covered ${covered}`);
  }
});

test('every position carries a stated confidence for calibration', () => {
  for (const position of positions) {
    assert.equal(typeof position.confidence, 'number', `${position.title}: no confidence`);
    assert.ok(Number.isFinite(position.confidence));
  }
});

test('a revision that records its confidence can be traced against the one before', () => {
  // The trace reads back to the last revision that kept a confidence, so a
  // history that mixes the two still reads continuously.
  const history = [{ confidence: 70 }, {}, { confidence: 58 }] as { confidence?: number }[];
  const priorOf = (index: number) => history.slice(0, index)
    .map((h) => h.confidence).filter((v): v is number => typeof v === 'number').at(-1);
  assert.equal(priorOf(0), undefined);
  assert.equal(priorOf(1), 70);
  assert.equal(priorOf(2), 70, 'a revision without a confidence must not break the chain');
});
