import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeTranscript } from '../src/transcript.js';

function transcript(text, partial = false, role = 'assistant') {
  return { type: 'transcript', role, transcript: text, transcriptType: partial ? 'partial' : 'final' };
}
function collect(events) {
  return events.reduce((state, [message, time]) => mergeTranscript(state, message, time), []);
}

test('partial revisions and replayed finals produce one complete message', () => {
  const result = collect([
    [transcript('Hello', true), 0],
    [transcript('Hello there', true), 10],
    [transcript('Hello there!'), 20],
    [transcript('Hello there!'), 30],
    [transcript(' hello  there. '), 40],
    [transcript('Hello', true), 50],
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].partial, false);
  assert.equal(result[0].text, 'hello  there.');
});

test('cumulative final sentences extend the previous message', () => {
  const result = collect([
    [transcript('Hello!'), 0],
    [transcript('How can I help', true), 10],
    [transcript('Hello! How can I help you?'), 20],
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'Hello! How can I help you?');
  assert.equal(result[0].partial, false);
});

test('distinct sentences and repeated words inside a sentence are retained', () => {
  const result = collect([
    [transcript('Hello there.'), 0],
    [transcript('That is very very helpful.'), 10],
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[1].text, 'That is very very helpful.');
});

test('same phrase from different speakers and later turns is retained', () => {
  const result = collect([
    [transcript('Yes.'), 0],
    [transcript('Yes.', false, 'user'), 10],
    [transcript('Yes.'), 20],
    [transcript('Yes.'), 5000],
  ]);
  assert.equal(result.length, 4);
});

test('late final completes a pending speaker without removing the interruption', () => {
  const result = collect([
    [transcript('Let me', true), 0],
    [transcript('Wait', true, 'user'), 10],
    [transcript('Let me explain.'), 20],
    [transcript('Wait, one question.', false, 'user'), 30],
  ]);
  assert.deepEqual(result.map(m => m.text), ['Let me explain.', 'Wait, one question.']);
  assert.ok(result.every(m => !m.partial));
});

test('corrected partials replace the draft even when wording changes', () => {
  const result = collect([
    [transcript('The flight is at nine', true, 'user'), 0],
    [transcript('The flight is at five.', false, 'user'), 30],
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'The flight is at five.');
});

test('empty, non-transcript, and unknown-speaker events do not create messages', () => {
  const empty = [];
  for (const event of [transcript(' '), transcript('test', false, 'system'), { type: 'other', transcript: 'test' }]) {
    assert.equal(mergeTranscript(empty, event, 0), empty);
  }
});

test('numeric values and word boundaries are not incorrectly merged', () => {
  assert.equal(collect([[transcript('1.2'), 0], [transcript('12'), 10]]).length, 2);
  assert.equal(collect([[transcript('He'), 0], [transcript('Hello'), 10]]).length, 2);
});
