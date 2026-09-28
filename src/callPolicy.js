// Mute stops speech reaching the assistant. Allow a long silent pause without
// overriding its separate maximum call duration or other assistant settings.
export const WEB_CALL_OVERRIDES = { silenceTimeoutSeconds: 3600 };

// These specific events are documented as nonfatal in the installed SDK.
// Transport, authentication, and unknown errors still follow the failure path.
const RECOVERABLE_AUDIO_ERRORS = new Set([
  'audio-processing-setup-error',
  'audio-processor-recovery-error',
  'audio-observer-setup-error',
]);

export function isRecoverableAudioError(error) {
  return RECOVERABLE_AUDIO_ERRORS.has(error?.type);
}

export function callEndedMessage(reason) {
  if (reason === 'silence-timed-out') return 'silenceTimeout';
  if (reason === 'exceeded-max-duration') return 'durationTimeout';
  return '';
}
