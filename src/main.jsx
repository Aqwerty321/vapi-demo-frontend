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
import { translations } from "./i18n";
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
  const [language, setLanguage] = useState("it");
  const t = translations[language];
  const [settings, setSettings] = useState(initialSettings);
  const [draft, setDraft] = useState(initialSettings);
  const [tab, setTab] = useState("transcript");
  const [notice, setNotice] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const pausedScrollTop = useRef(0);
  const dialog = useRef(null);
  const transcript = useRef(null);
  const voice = useVoice(t);
  const busy = ["connecting", "live", "stopping"].includes(voice.phase);
  const live = voice.phase === "live";
  const connecting = voice.phase === "connecting";
  const configured = Boolean(
    settings.publicKey.trim() && settings.assistantId.trim(),
  );
  const stateLabel = connecting
    ? t.connecting
    : voice.phase === "stopping"
      ? t.stopping
      : live
        ? voice.speaking
          ? t.speaking
          : voice.muted
            ? t.microphoneMuted
            : t.listening
        : voice.phase === "error"
          ? t.interrupted
          : t.ready;
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.description);
  }, [language, t]);
  useLayoutEffect(() => {
    const frame = transcript.current;
    if (!frame) return;
    frame.scrollTop = autoScroll ? frame.scrollHeight : pausedScrollTop.current;
  }, [voice.messages, tab, autoScroll, language]);
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
      .map((m) => `${m.role === "assistant" ? t.assistant : t.you}: ${m.text}`)
      .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "voice-lab-conversation.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("downloaded");
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
        <a className="brand" href="#" aria-label={t.home}>
          <span className="brand-icon">
            <AudioLines size={23} />
          </span>
          <span>BitLab</span>
        </a>
        <div className="topbar-right">
          <div className="language-switch" role="group" aria-label={t.language}>
            <button type="button" lang="it" aria-label="Italiano" aria-pressed={language === "it"} onClick={() => setLanguage("it")}>IT</button>
            <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
          </div>
          <span className="workspace-tag">
            <span className="dot" /> {t.workspace}
          </span>
          <button
            className="icon-button"
            onClick={openSettings}
            disabled={busy}
            aria-label={t.openSettings}
            title={t.settings}
          >
            <Settings2 size={18} />
          </button>
          <div className="avatar" aria-label={t.workspace}>
            V
          </div>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <h1>{t.voiceSession}</h1>
          <button
            className="text-link docs-link"
            onClick={() => {
              setTab("guide");
              document.getElementById("guide-tab")?.focus();
            }}
          >
            {t.guide} <ArrowUpRight size={15} />
          </button>
        </section>
        <section className="console-grid" aria-label={t.voiceWorkspace}>
          <div className={`voice-panel glass ${live ? "is-live" : ""}`}>
            <div className="panel-top">
              <span className="section-label">
                <Radio size={14} /> {t.session}
              </span>
              <span className={`state-pill ${live ? "live" : ""}`}>
                <span className="dot" />
                {live ? t.liveSession : connecting ? t.connectingBadge : t.standby}
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
                  voice.muted ? t.unmute : t.mute
                }
                aria-pressed={voice.muted}
                title={voice.muted ? t.unmute : t.mute}
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
                    ? t.cancel
                    : live
                      ? t.end
                      : voice.phase === "stopping"
                        ? t.ending
                        : t.start}
                </span>
                {!busy && <ArrowUpRight size={17} />}
              </button>
              <button
                className="round-control"
                onClick={openSettings}
                disabled={busy}
                aria-label={t.configure}
                title={t.configure}
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
                  <span className="micro-label">{t.duration}</span>
                  <strong>{timeLabel(voice.seconds)}</strong>
                </div>
              </div>
              <div>
                <span className="strip-icon">
                  <Waves size={17} />
                </span>
                <div>
                  <span className="micro-label">{t.audioInput}</span>
                  <strong>
                    {live
                      ? voice.muted
                        ? t.muted
                        : t.microphoneOn
                      : t.disconnected}
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
                <MessageSquare size={15} /> {t.transcript}
              </span>
              <button
                className="icon-button"
                onClick={download}
                disabled={!voice.messages.length}
                aria-label={t.download}
                title={t.download}
              >
                <ArrowDownToLine size={16} />
              </button>
            </div>
            <div
              className="tabs"
              role="tablist"
              aria-label={t.conversationPanel}
            >
              <button
                role="tab"
                id="transcript-tab"
                aria-controls="transcript-panel"
                aria-selected={tab === "transcript"}
                onClick={() => setTab("transcript")}
              >
                {t.liveTranscript} {live && <span className="dot" />}
              </button>
              <button
                role="tab"
                id="guide-tab"
                aria-controls="guide-panel"
                aria-selected={tab === "guide"}
                onClick={() => setTab("guide")}
              >
                {t.guide} <ArrowUpRight size={12} />
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
                              t.userInitial
                            )}
                          </span>
                          <span>
                            {m.role === "assistant" ? t.assistant : t.you}
                          </span>
                          {m.partial && (
                            <span className="partial-indicator">{t.speakingShort}</span>
                          )}
                        </div>
                        <p>{m.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-transcript">
                    <MessageSquare size={23} strokeWidth={1} aria-hidden="true" />
                    <p>{t.empty}</p>
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
                <h3>{t.gettingStarted}</h3>
                {t.steps.map(([n, title, copy]) => (
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
                  {t.settings} <ChevronRight size={15} />
                </button>
              </div>
            )}
            <div className="transcript-footer">
              <span className={`dot ${live ? "mint" : ""}`} />
              <span>{live ? t.live : t.idle}</span>
              <button
                className="scroll-toggle"
                onClick={toggleAutoScroll}
                disabled={tab !== "transcript"}
                aria-label={autoScroll ? t.pauseScrollLabel : t.resumeScrollLabel}
                aria-pressed={!autoScroll}
                title={autoScroll ? t.pauseScrollHint : t.resumeScrollHint}
              >
                {autoScroll ? <Pause size={12} /> : <Play size={12} />}
                {autoScroll ? t.pauseScroll : t.resumeScroll}
              </button>
            </div>
          </aside>
        </section>
      </main>
      <dialog
        ref={dialog}
        className="settings-dialog"
        aria-label={t.settings}
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
            setNotice("saved");
          }}
        >
          <div className="dialog-heading">
            <span className="section-label">
              <Settings2 size={15} /> {t.settings.toLocaleUpperCase(language)}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={() => dialog.current.close()}
              aria-label={t.closeSettings}
            >
              <X size={20} />
            </button>
          </div>
          <h2>{t.connection}</h2>
          <label htmlFor="public-key">{t.publicKey}</label>
          <input
            id="public-key"
            type="password"
            autoComplete="off"
            required
            value={draft.publicKey}
            onChange={(e) => setDraft({ ...draft, publicKey: e.target.value })}
            placeholder={t.publicKeyPlaceholder}
            disabled={busy}
          />
          <small>{t.keyHint}</small>
          <label htmlFor="assistant-id">{t.assistantId}</label>
          <input
            id="assistant-id"
            autoComplete="off"
            required
            value={draft.assistantId}
            onChange={(e) =>
              setDraft({ ...draft, assistantId: e.target.value })
            }
            placeholder={t.assistantIdPlaceholder}
            disabled={busy}
          />
          <small>
            {t.settingsHint}
          </small>
          <button
            type="submit"
            className="call-button save-button"
            disabled={busy}
          >
            <Check size={17} /> {t.save}
          </button>
        </form>
      </dialog>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {t[notice]}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
