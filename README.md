# Vapi Voice Lab

A responsive glass interface with a React Bits WebGL orb, real-time transcripts, microphone controls, and transcript export. The transcript stays in a fixed-height frame. Scroll upward or choose **Pause scroll** to hold your reading position while new messages continue arriving; **Resume scroll** jumps to the latest. This pauses auto-scroll, not the call or transcription.

## Start

The interface opens in Italian by default. The header’s IT / EN switch changes interface text and transcript speaker labels without interrupting an active call. Transcript content is preserved verbatim. The assistant’s spoken language is configured separately in the provider dashboard; this frontend translation does not change it.

```sh
npm install
npm run dev
```

Configure `VITE_VAPI_PUBLIC_KEY` and `VITE_VAPI_ASSISTANT_ID` in `.env` using `.env.example`, or enter them in the connection settings dialog. Use a **public** Vapi key; all `VITE_` variables are exposed to the browser. Dialog settings last for the current tab session and are not persisted.

Allow microphone permission when starting a conversation. The Vapi SDK handles audio transport. If the public key restricts origins, allow the exact local origin displayed by Vite.

The microphone button mutes your input, not the assistant's playback. Browser calls use a 3,600-second silence allowance so muted pauses do not trigger the short default silence timeout. The assistant's maximum call duration and other end-call rules still apply. Muted calls remain connected and can continue accruing usage. Recoverable audio-enhancement errors show a notice instead of disconnecting the call.

## Verify

```sh
npm run build
npx playwright install chromium
```

With the dev server running on `http://127.0.0.1:5173`, run `npm run test:ui`. This checks desktop/mobile rendering, settings, error handling, and simulated call controls. It blocks external network traffic, does not make live calls, and writes screenshots to `test-results/`.

Run `npm run test:mute` for the local mute regression, including a simulated 90-second pause, audio recovery, mute preservation, failures, and end reasons. To explicitly make a real test call with the configured assistant, run `node scripts/verify-mute.mjs --live`. It uses a synthetic microphone, checks 75 seconds of muting and repeated unmute cycles, and ends the call automatically. The live check incurs normal call usage; it does not test your physical microphone.

## Visuals

The orb uses the React Bits shader, adapted for Vapi audio levels, reduced motion, and a CSS fallback when WebGL is unavailable. The backdrop uses the downloaded React Bits Aurora component with violet/cyan/orchid colors, `speed={0.38}`, `amplitude={1.2}`, `blend={0.48}`, and 62% layer opacity. A soft light ridge defines the flowing curtain. Adjust the props in `src/main.jsx` and `.aurora-backdrop` in `src/styles.css` to tune it. The background caps rendering at 30 fps, pauses in hidden tabs, and renders a still frame for reduced motion. Fonts are served locally. See `THIRD_PARTY_NOTICES.md` for the component licenses.
