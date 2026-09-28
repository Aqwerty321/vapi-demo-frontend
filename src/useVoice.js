import { useEffect, useRef, useState } from "react";
import VapiModule from "@vapi-ai/web";
import { mergeTranscript } from "./transcript";
import { WEB_CALL_OVERRIDES, isRecoverableAudioError, callEndedMessage } from "./callPolicy";
const Vapi = VapiModule.default || VapiModule;
function errorText(error) {
  const detail =
    error?.error?.message || error?.errorMsg || error?.message || error?.error;
  return typeof detail === "string"
    ? detail.replace(/\bvapi\b/gi, "voice service")
    : "Could not connect. Check microphone permission and your connection settings.";
}
export function useVoice() {
  const client = useRef(null),
    timeout = useRef(null),
    attempt = useRef(0),
    locked = useRef(false),
    desiredMuted = useRef(false);
  const [phase, setPhase] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(
    () => () => {
      attempt.current++;
      clearTimeout(timeout.current);
      client.current?.stop().catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (phase !== "live") return;
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase]);
  async function stop() {
    attempt.current++;
    clearTimeout(timeout.current);
    setPhase("stopping");
    const previous = client.current;
    client.current = null;
    try {
      await previous?.stop();
    } catch {
      setError("The connection was interrupted while ending the session.");
    }
    locked.current = false;
    setPhase("idle");
    setSpeaking(false);
    setVolume(0);
    desiredMuted.current = false;
    setMuted(false);
    setWarning("");
  }
  async function start(settings) {
    if (locked.current) return;
    locked.current = true;
    const id = ++attempt.current;
    const current = () => id === attempt.current;
    setError("");
    setWarning("");
    setPhase("connecting");
    setMessages([]);
    setSeconds(0);
    desiredMuted.current = false;
    setMuted(false);
    let vapi;
    const fail = async (reason) => {
      if (!current()) return;
      attempt.current++;
      clearTimeout(timeout.current);
      setError(errorText(reason));
      setPhase("stopping");
      setWarning("");
      desiredMuted.current = false;
      setMuted(false);
      setVolume(0);
      setSpeaking(false);
      try {
        await vapi?.stop();
      } catch {
        /* Preserve the original startup error. */
      }
      client.current = null;
      locked.current = false;
      setPhase("error");
    };
    try {
      vapi = new Vapi(settings.publicKey.trim());
      client.current = vapi;
      vapi.on("call-start", () => {
        if (!current()) return;
        clearTimeout(timeout.current);
        setPhase("live");
      });
      const finish = (reason) => {
        if (!current()) return;
        attempt.current++;
        clearTimeout(timeout.current);
        locked.current = false;
        client.current = null;
        setPhase("idle");
        setSpeaking(false);
        setVolume(0);
        desiredMuted.current = false;
        setMuted(false);
        setWarning("");
        setError(callEndedMessage(reason));
        // Status 'ended' may precede the transport's call-end event.
        vapi.stop().catch(() => {});
      };
      vapi.on("call-end", () => finish());
      let restoringMute = false;
      vapi.on("daily-participant-updated", (participant) => {
        if (!current() || !participant?.local || restoringMute) return;
        // The SDK's noise-processor recovery can enable local audio. Preserve
        // an explicit user mute even when that recovery replaces the track.
        if (desiredMuted.current && !vapi.isMuted()) {
          restoringMute = true;
          try { vapi.setMuted(true); }
          catch { setError("Could not keep the microphone muted. End the call if needed."); }
          finally { restoringMute = false; }
        }
      });
      vapi.on("speech-start", () => {
        if (current()) setSpeaking(true);
      });
      vapi.on("speech-end", () => {
        if (current()) setSpeaking(false);
      });
      vapi.on("volume-level", (value) => {
        if (current()) setVolume(Math.max(0, Math.min(1, Number(value) || 0)));
      });
      vapi.on("message", (message) => {
        if (!current()) return;
        if (message.type === "status-update" && message.status === "ended") {
          finish(message.endedReason);
          return;
        }
        if (!current() || message.type !== "transcript" || !message.transcript)
          return;
        const receivedAt = Date.now();
        setMessages(previous => mergeTranscript(previous, message, receivedAt));
      });
      vapi.on("call-start-failed", fail);
      vapi.on("error", (reason) => {
        if (!current()) return;
        if (isRecoverableAudioError(reason)) {
          setWarning("Audio enhancement is unavailable. The call can continue.");
          return;
        }
        void fail(reason);
      });
      timeout.current = setTimeout(
        () =>
          fail({
            message:
              "Connection timed out. Check microphone permission, your network, and the public key’s allowed origins in your provider dashboard.",
          }),
        30000,
      );
      const call = await vapi.start(settings.assistantId.trim(), WEB_CALL_OVERRIDES);
      if (!current()) {
        await vapi.stop();
        return;
      }
      if (!call)
        await fail({
          message:
            "Could not create this call. Check your public key and assistant ID.",
        });
    } catch (reason) {
      await fail(reason);
    }
  }
  function toggleMute() {
    if (phase !== "live" || !client.current) return;
    const activeClient = client.current;
    const id = attempt.current;
    const previousMuted = desiredMuted.current;
    const nextMuted = !previousMuted;
    desiredMuted.current = nextMuted;
    try {
      activeClient.setMuted(nextMuted);
      if (attempt.current === id && client.current === activeClient) {
        setMuted(nextMuted);
        setError("");
      }
    } catch {
      if (attempt.current === id && client.current === activeClient) {
        desiredMuted.current = previousMuted;
        setMuted(previousMuted);
        setError("Could not change the microphone state. Please try again.");
      }
    }
  }
  return {
    phase,
    messages,
    error,
    warning,
    muted,
    speaking,
    volume,
    seconds,
    start,
    stop,
    toggleMute,
  };
}
