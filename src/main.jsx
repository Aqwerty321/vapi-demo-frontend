import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  LoaderCircle,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  Settings2,
  Square,
  Waves,
  X,
} from "lucide-react";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import Orb from "./components/Orb";
import Aurora from "./components/Aurora";
import { useVoice } from "./useVoice";
import "./styles.css";

const initialSettings = {
  publicKey: import.meta.env.VITE_VAPI_PUBLIC_KEY || "",
  assistantId: import.meta.env.VITE_VAPI_ASSISTANT_ID || "",
};
// Saturated color at the edges; the panels keep a quiet reading surface.
const BACKGROUND_COLORS = ["#8952EC", "#4C9FC8", "#BE6FD1"];
const timeLabel = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function App() {
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState(initialSettings);
  const [tab, setTab] = useState("transcript");
  const [notice, setNotice] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const pausedScrollTop = useRef(0);
  const dialog = useRef(null);
  const transcript = useRef(null);
  const voice = useVoice();
  const busy = ["connecting", "live", "stopping"].includes(voice.phase);
  const live = voice.phase === "live";
  const connecting = voice.phase === "connecting";
  const configured = Boolean(
    settings.publicKey.trim() && settings.assistantId.trim(),
  );
  const stateLabel = connecting
    ? "Establishing connection"
    : voice.phase === "stopping"
      ? "Ending session"
      : live
        ? voice.speaking
          ? "Assistant is speaking"
          : voice.muted
            ? "Microphone muted"
            : "Listening to you"
        : voice.phase === "error"
          ? "Connection interrupted"
          : "Ready";
  useLayoutEffect(() => {
    const frame = transcript.current;
    if (!frame) return;
    frame.scrollTop = autoScroll ? frame.scrollHeight : pausedScrollTop.current;
  }, [voice.messages, tab, autoScroll]);
  function handleTranscriptScroll(event) {
    const frame = event.currentTarget;
    pausedScrollTop.current = frame.scrollTop;
    if (frame.scrollHeight - frame.clientHeight - frame.scrollTop > 32) {
      setAutoScroll(false);
    }
  }
  function toggleAutoScroll() {
    pausedScrollTop.current = transcript.current?.scrollTop ?? pausedScrollTop.current;
    setAutoScroll(value => !value);
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  function openSettings() {
    setDraft(settings);
    dialog.current.showModal();
  }
  function start() {
    if (!configured) {
      openSettings();
      return;
    }
    setTab("transcript");
    setAutoScroll(true);
    pausedScrollTop.current = 0;
    voice.start(settings);
  }
  function download() {
    const text = voice.messages
      .map((m) => `${m.role === "assistant" ? "Assistant" : "You"}: ${m.text}`)
      .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "voice-lab-conversation.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Transcript downloaded");
  }
  return (
    <div className="app-shell">
      <div className="aurora-backdrop" aria-hidden="true">
        <Aurora
          colorStops={BACKGROUND_COLORS}
          speed={0.38}
          amplitude={1.2}
          blend={0.48}
        />
      </div>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Voice Lab home">
          <span className="brand-icon">
            <AudioLines size={23} />
          </span>
          <span>voice lab</span>
        </a>
        <div className="topbar-right">
          <span className="workspace-tag">
            <span className="dot" /> Personal workspace
          </span>
          <button
            className="icon-button"
            onClick={openSettings}
            disabled={busy}
            aria-label="Open connection settings"
            title="Connection settings"
          >
            <Settings2 size={18} />
          </button>
          <div className="avatar" aria-label="Personal workspace">
            V
          </div>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <h1>Voice session</h1>
          <button
            className="text-link docs-link"
            onClick={() => {
              setTab("guide");
              document.getElementById("guide-tab")?.focus();
            }}
          >
            Quick guide <ArrowUpRight size={15} />
          </button>
        </section>
        <section className="console-grid" aria-label="Voice workspace">
          <div className={`voice-panel glass ${live ? "is-live" : ""}`}>
            <div className="panel-top">
              <span className="section-label">
                <Radio size={14} /> SESSION
              </span>
              <span className={`state-pill ${live ? "live" : ""}`}>
                <span className="dot" />
                {live ? "LIVE SESSION" : connecting ? "CONNECTING" : "STANDBY"}
              </span>
            </div>
            <div className="orb-stage">
              <div className="orbit orbit-one" aria-hidden="true" />
              <div className="orbit orbit-two" aria-hidden="true" />
              <div className="orb-glow" aria-hidden="true" />
              <div
                className="orb-visual"
                style={{ "--voice-scale": 1 + voice.volume * 0.09 }}
              >
                <Orb active={live} level={voice.volume} />
                <div className="orb-center" aria-hidden="true">
                  <AudioLines size={38} strokeWidth={1.3} />
                </div>
              </div>
            </div>
            <div className="session-prompt">
              <p role="status">{stateLabel}</p>
            </div>
            <div className="call-controls">
              <button
                className={`round-control ${voice.muted ? "muted-control" : ""}`}
                disabled={!live}
                onClick={voice.toggleMute}
                aria-label={
                  voice.muted ? "Unmute microphone" : "Mute microphone"
                }
                aria-pressed={voice.muted}
                title={voice.muted ? "Unmute microphone" : "Mute microphone"}
              >
                {voice.muted ? <MicOff size={19} /> : <Mic size={19} />}
              </button>
              <button
                className={`call-button ${busy ? "end-button" : ""}`}
                onClick={busy ? voice.stop : start}
                disabled={voice.phase === "stopping"}
              >
                {connecting ? (
                  <LoaderCircle size={18} className="spin" />
                ) : live ? (
                  <Square size={15} fill="currentColor" />
                ) : (
                  <AudioLines size={19} />
                )}
                <span>
                  {connecting
                    ? "Cancel connection"
                    : live
                      ? "End conversation"
                      : voice.phase === "stopping"
                        ? "Ending session…"
                        : "Start conversation"}
                </span>
                {!busy && <ArrowUpRight size={17} />}
              </button>
              <button
                className="round-control"
                onClick={openSettings}
                disabled={busy}
                aria-label="Configure assistant"
                title="Configure assistant"
              >
                <Settings2 size={19} />
              </button>
            </div>
            {voice.error && (
              <div className="error-message" role="alert">
                <CircleHelp size={16} />
                <span>{voice.error}</span>
              </div>
            )}
            {voice.warning && !voice.error && (
              <div className="error-message audio-warning" role="status">
                <CircleHelp size={16} />
                <span>{voice.warning}</span>
              </div>
            )}
            <div className="session-strip">
              <div>
                <span className="strip-icon">
                  <Clock3 size={16} />
                </span>
                <div>
                  <span className="micro-label">SESSION TIME</span>
                  <strong>{timeLabel(voice.seconds)}</strong>
                </div>
              </div>
              <div>
                <span className="strip-icon">
                  <Waves size={17} />
                </span>
                <div>
                  <span className="micro-label">AUDIO INPUT</span>
                  <strong>
                    {live
                      ? voice.muted
                        ? "Muted"
                        : "Microphone on"
                      : "Not connected"}
                  </strong>
                </div>
              </div>
              <div className="strip-wave" aria-hidden="true">
                {Array.from({ length: 20 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      height: live
                        ? `${4 + Math.sin(i * 1.9) ** 2 * voice.volume * 28}px`
                        : `${4 + Math.sin(i * 1.4) ** 2 * 8}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <aside className="conversation-panel glass">
            <div className="conversation-heading">
              <span className="section-label">
                <MessageSquare size={15} /> TRANSCRIPT
              </span>
              <button
                className="icon-button"
                onClick={download}
                disabled={!voice.messages.length}
                aria-label="Download transcript"
                title="Download transcript"
              >
                <ArrowDownToLine size={16} />
              </button>
            </div>
            <div
              className="tabs"
              role="tablist"
              aria-label="Conversation panel"
            >
              <button
                role="tab"
                id="transcript-tab"
                aria-controls="transcript-panel"
                aria-selected={tab === "transcript"}
                onClick={() => setTab("transcript")}
              >
                Live transcript {live && <span className="dot" />}
              </button>
              <button
                role="tab"
                id="guide-tab"
                aria-controls="guide-panel"
                aria-selected={tab === "guide"}
                onClick={() => setTab("guide")}
              >
                Quick guide <ArrowUpRight size={12} />
              </button>
            </div>
            {tab === "transcript" ? (
              <div
                className="transcript-scroll"
                ref={transcript}
                onScroll={handleTranscriptScroll}
                role="tabpanel"
                id="transcript-panel"
                aria-labelledby="transcript-tab"
                tabIndex={0}
              >
                {voice.messages.length ? (
                  <div className="messages" role="log" aria-live={autoScroll ? "polite" : "off"}>
                    {voice.messages.map((m, i) => (
                      <div className={`message ${m.role}`} key={i}>
                        <div className="message-heading">
                          <span
                            className={`message-avatar ${m.role === "assistant" ? "ai-avatar" : ""}`}
                          >
                            {m.role === "assistant" ? (
                              <AudioLines size={12} />
                            ) : (
                              "Y"
                            )}
                          </span>
                          <span>
                            {m.role === "assistant" ? "Assistant" : "You"}
                          </span>
                          {m.partial && (
                            <span className="partial-indicator">speaking</span>
                          )}
                        </div>
                        <p>{m.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-transcript">
                    <MessageSquare size={23} strokeWidth={1} aria-hidden="true" />
                    <p>No transcript yet.</p>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="guide-panel"
                role="tabpanel"
                id="guide-panel"
                aria-labelledby="guide-tab"
                tabIndex={0}
              >
                <h3>Getting started</h3>
                {[
                  [
                    "01",
                    "Connect",
                    "Add your public key and assistant ID in connection settings.",
                  ],
                  [
                    "02",
                    "Start",
                    "Press start and allow microphone access when your browser asks.",
                  ],
                  [
                    "03",
                    "Review",
                    "Scroll up or pause auto-scroll to read earlier messages. Resume to jump to the latest.",
                  ],
                ].map(([n, title, copy]) => (
                  <div className="guide-step" key={n}>
                    <span>{n}</span>
                    <div>
                      <h4>{title}</h4>
                      <p>{copy}</p>
                    </div>
                  </div>
                ))}
                <button
                  className="guide-settings"
                  disabled={busy}
                  onClick={openSettings}
                >
                  Connection settings <ChevronRight size={15} />
                </button>
              </div>
            )}
            <div className="transcript-footer">
              <span className={`dot ${live ? "mint" : ""}`} />
              <span>{live ? "Live" : "Idle"}</span>
              <button
                className="scroll-toggle"
                onClick={toggleAutoScroll}
                disabled={tab !== "transcript"}
                aria-label={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
                aria-pressed={!autoScroll}
                title={autoScroll ? "Pause scrolling; transcript continues updating" : "Resume and jump to latest"}
              >
                {autoScroll ? <Pause size={12} /> : <Play size={12} />}
                {autoScroll ? "Pause scroll" : "Resume scroll"}
              </button>
            </div>
          </aside>
        </section>
      </main>
      <dialog
        ref={dialog}
        className="settings-dialog"
        aria-label="Connection settings"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSettings({
              publicKey: draft.publicKey.trim(),
              assistantId: draft.assistantId.trim(),
            });
            dialog.current.close();
            setNotice("Connection settings saved");
          }}
        >
          <div className="dialog-heading">
            <span className="section-label">
              <Settings2 size={15} /> CONNECTION SETTINGS
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => dialog.current.close()}
              aria-label="Close settings"
            >
              <X size={20} />
            </button>
          </div>
          <h2>Connection</h2>
          <label htmlFor="public-key">Public key</label>
          <input
            id="public-key"
            type="password"
            autoComplete="off"
            required
            value={draft.publicKey}
            onChange={(e) => setDraft({ ...draft, publicKey: e.target.value })}
            placeholder="Enter your public key"
            disabled={busy}
          />
          <small>Use a public key. Private keys belong on a server.</small>
          <label htmlFor="assistant-id">Assistant ID</label>
          <input
            id="assistant-id"
            autoComplete="off"
            required
            value={draft.assistantId}
            onChange={(e) =>
              setDraft({ ...draft, assistantId: e.target.value })
            }
            placeholder="Enter your assistant ID"
            disabled={busy}
          />
          <small>
            Find these in your provider dashboard. Settings stay in this tab.
          </small>
          <button
            type="submit"
            className="call-button save-button"
            disabled={busy}
          >
            <Check size={17} /> Save connection
          </button>
        </form>
      </dialog>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
