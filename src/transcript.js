// Without a provider utterance ID, only coalesce adjacent updates from the
// same speaker in a short delivery window. Never deduplicate the whole call:
// saying the same thing in a later turn is valid conversation.
const UPDATE_WINDOW_MS = 3000;
const normalize = text => text.normalize('NFKC').toLowerCase()
  .replace(/[.!?,;:…]+(?=\s|$)/gu, '').replace(/\s+/g, ' ').trim();
const extendsText = (longer, shorter) => longer.startsWith(`${shorter} `);

export function mergeTranscript(previous, message, receivedAt) {
  if (message.type !== 'transcript' || typeof message.transcript !== 'string'
    || !['assistant', 'user'].includes(message.role)) return previous;
  const text = message.transcript.trim();
  if (!text) return previous;
  const entry = { role: message.role, text, partial: message.transcriptType === 'partial', receivedAt };
  // A speaker may finish their transcript just after the other starts talking.
  const pending = previous.findLastIndex(item => item.role === entry.role
    && item.partial && receivedAt - item.receivedAt <= UPDATE_WINDOW_MS);
  const next = [...previous];
  const index = pending === -1 ? next.length : pending;
  next[index] = entry;

  const prior = next[index - 1];
  if (!prior || prior.role !== entry.role || prior.partial
    || receivedAt - prior.receivedAt > UPDATE_WINDOW_MS) return next;
  const before = normalize(prior.text), after = normalize(entry.text);
  if (!before || !after) return next;
  if (before === after || extendsText(before, after)) {
    // Ignore repeated finals and stale partials without downgrading a final.
    // Prefer the final's latest punctuation when the words are identical.
    if (before === after && !entry.partial) next[index - 1] = entry;
    next.splice(index, 1);
  } else if (extendsText(after, before)) {
    // Some providers resend the whole utterance with each added sentence.
    next[index - 1] = entry;
    next.splice(index, 1);
  }
  return next;
}
