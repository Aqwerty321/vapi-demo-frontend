import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Local UI verification only: external requests are blocked and calls are simulated.
const origin = "http://127.0.0.1:5173";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
});
const failures = [];
async function newPage(viewport) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  return { page, context };
}

try {
  const { page, context } = await newPage({ width: 1440, height: 1050 });
  await page.goto(origin);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveTitle('Voice Lab');
  await expect(page.locator('body')).not.toContainText(/vapi/i);
  await expect(
    page.getByRole("heading", { name: "Voice session", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".orb-container canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.getByRole("tab", { name: "Quick guide" }).click();
  await expect(
    page.getByRole("heading", { name: "Getting started", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connection settings", exact: true })
    .click();
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/vapi/i);
  await page
    .getByLabel("Public key", { exact: true })
    .fill("ui-test-public-key");
  await page
    .getByLabel("Assistant ID", { exact: true })
    .fill("ui-test-assistant");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  await context.route("https://api.vapi.ai/**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Test connection rejected" }),
    }),
  );
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Start conversation" }),
  ).toBeEnabled();
  await context.close();

  const mobile = await newPage({ width: 390, height: 844 });
  await mobile.page.goto(origin);
  await mobile.page.evaluate(() => document.fonts.ready);
  await expect(
    mobile.page.getByRole("button", { name: "Start conversation" }),
  ).toBeVisible();
  const overflow = await mobile.page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await mobile.page.screenshot({
    path: "test-results/mobile.png",
    fullPage: true,
  });
  await mobile.page
    .getByRole("button", { name: "Configure assistant", exact: true })
    .click();
  await expect(mobile.page.locator("dialog")).toBeVisible();
  await mobile.page.keyboard.press("Escape");
  await expect(mobile.page.locator("dialog")).not.toBeVisible();
  await mobile.context.close();

  const live = await newPage({ width: 1440, height: 1050 });
  await live.context.route("**/*@vapi-ai_web*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    class FakeVapi {
      handlers = {}; stopped = false;
      on(name, fn) { this.handlers[name] = fn; }
      async start() {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (this.stopped) return null;
        this.handlers['call-start']?.();
        this.handlers['speech-start']?.();
        this.handlers['volume-level']?.(.65);
        window.__emitTranscript = (text, role = 'assistant') => this.handlers.message?.({type:'transcript',role,transcriptType:'final',transcript:text});
        this.handlers.message?.({type:'transcript',role:'assistant',transcriptType:'partial',transcript:'Hello'});
        this.handlers.message?.({type:'transcript',role:'assistant',transcriptType:'final',transcript:'Hello!'});
        this.handlers.message?.({type:'transcript',role:'assistant',transcriptType:'partial',transcript:'What would you like to explore'});
        this.handlers.message?.({type:'transcript',role:'assistant',transcriptType:'final',transcript:'Hello! What would you like to explore today?'});
        this.handlers.message?.({type:'transcript',role:'assistant',transcriptType:'final',transcript:'Hello! What would you like to explore today?'});
        this.handlers.message?.({type:'transcript',role:'assistant',transcriptType:'partial',transcript:'Hello! What would you like to explore today'});
        return {id:'simulated-call'};
      }
      async stop() { this.stopped = true; this.handlers['call-end']?.(); }
      setMuted(value) { window.__testMuted = value; }
    }
    export default { default: FakeVapi };
  `,
    }),
  );
  await live.page.goto(origin);
  await live.page
    .getByRole("button", { name: "Open connection settings" })
    .click();
  await live.page
    .getByLabel("Public key", { exact: true })
    .fill("ui-test-public-key");
  await live.page
    .getByLabel("Assistant ID", { exact: true })
    .fill("ui-test-assistant");
  await live.page.getByRole("button", { name: "Save connection" }).click();
  await live.page.getByRole("button", { name: "Start conversation" }).click();
  await expect(
    live.page.getByRole("button", { name: "End conversation" }),
  ).toBeVisible();
  await expect(live.page.locator(".message")).toHaveCount(1);
  await expect(live.page.locator(".message p")).toHaveText(
    "Hello! What would you like to explore today?",
  );
  await live.page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .click();
  expect(await live.page.evaluate(() => window.__testMuted)).toBe(true);
  await live.page
    .getByRole("button", { name: "Unmute microphone", exact: true })
    .click();
  expect(await live.page.evaluate(() => window.__testMuted)).toBe(false);
  await live.page.screenshot({
    path: "test-results/live-simulated.png",
    fullPage: true,
  });
  const downloaded = live.page.waitForEvent("download");
  await live.page.getByRole("button", { name: "Download transcript" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("voice-lab-conversation.txt");
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe('Assistant: Hello! What would you like to explore today?');
  const panel = live.page.locator('.conversation-panel');
  const scrollFrame = live.page.locator('.transcript-scroll');
  const heightBefore = await panel.evaluate(el => el.clientHeight);
  const documentHeightBefore = await live.page.evaluate(() => document.documentElement.scrollHeight);
  const isAtBottom = () => scrollFrame.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop < 3);
  await live.page.evaluate(() => {
    for (let i = 0; i < 40; i++) window.__emitTranscript('Message ' + i + ': A longer transcript entry to verify scrolling inside a fixed frame.', i % 2 ? 'user' : 'assistant');
  });
  await expect(live.page.locator('.message')).toHaveCount(41);
  expect(await panel.evaluate(el => el.clientHeight)).toBe(heightBefore);
  expect(await live.page.evaluate(() => document.documentElement.scrollHeight)).toBe(documentHeightBefore);
  await expect.poll(isAtBottom).toBe(true);
  await live.page.getByRole('button', { name: 'Pause auto-scroll' }).click();
  const pausedAt = await scrollFrame.evaluate(el => el.scrollTop);
  await live.page.evaluate(() => window.__emitTranscript('New message while scrolling is paused.'));
  await expect(live.page.locator('.message')).toHaveCount(42);
  expect(await scrollFrame.evaluate(el => el.scrollTop)).toBe(pausedAt);
  await expect(live.page.getByRole('button', { name: 'End conversation' })).toBeVisible();
  await live.page.getByRole('button', { name: 'Resume auto-scroll' }).click();
  await expect.poll(isAtBottom).toBe(true);
  // Scrolling up with the scrollbar pauses following, including across tab switches.
  await scrollFrame.evaluate(el => { el.scrollTop = 50; el.dispatchEvent(new Event('scroll')); });
  await expect(live.page.getByRole('button', { name: 'Resume auto-scroll' })).toBeVisible();
  await live.page.getByRole('tab', { name: 'Quick guide' }).click();
  await live.page.getByRole('tab', { name: 'Live transcript' }).click();
  expect(await scrollFrame.evaluate(el => el.scrollTop)).toBe(50);
  await live.page.evaluate(() => window.__emitTranscript('Another message while reviewing history.'));
  await expect(live.page.locator('.message')).toHaveCount(43);
  expect(await scrollFrame.evaluate(el => el.scrollTop)).toBe(50);
  await live.page.getByRole('button', { name: 'Resume auto-scroll' }).click();
  await expect.poll(isAtBottom).toBe(true);
  await live.page.screenshot({ path: 'test-results/transcript-long.png', fullPage: true });
  await live.page.setViewportSize({ width: 390, height: 844 });
  await live.page.evaluate(() => window.__emitTranscript('One more entry on mobile.'));
  await expect(live.page.locator('.message')).toHaveCount(44);
  expect(await panel.evaluate(el => el.clientHeight)).toBe(518);
  await expect.poll(isAtBottom).toBe(true);
  await live.page.getByRole('button', { name: 'Pause auto-scroll' }).click();
  const mobilePausedAt = await scrollFrame.evaluate(el => el.scrollTop);
  await live.page.evaluate(() => window.__emitTranscript('Mobile paused entry.'));
  await expect(live.page.locator('.message')).toHaveCount(45);
  expect(await scrollFrame.evaluate(el => el.scrollTop)).toBe(mobilePausedAt);
  await live.page.getByRole('button', { name: 'Resume auto-scroll' }).click();
  await expect.poll(isAtBottom).toBe(true);
  await live.page.getByRole("button", { name: "End conversation" }).click();
  await expect(
    live.page.getByRole("button", { name: "Start conversation" }),
  ).toBeVisible();
  await live.page.getByRole("button", { name: "Start conversation" }).click();
  await live.page.getByRole("button", { name: "Cancel connection" }).click();
  await expect(
    live.page.getByRole("button", { name: "Start conversation" }),
  ).toBeVisible();
  await live.context.close();
  expect(failures).toEqual([]);
  console.log(
    "PASS: desktop/mobile layout, fixed transcript frame, auto-scroll, pause/resume, manual scroll, settings, guide, SDK error display, simulated call, transcript, mute, download, end, cancel. No page errors. No live calls made.",
  );
} finally {
  await browser.close();
}
