import { chromium, expect } from '@playwright/test';

// Default: deterministic local regression. --live uses the configured assistant
// and synthetic microphone for a short, potentially billable real web call.
const live = process.argv.includes('--live');
const browser = await chromium.launch({ args: [
  '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required',
] });
const context = await browser.newContext({ permissions: ['microphone'], reducedMotion: 'reduce' });
const page = await context.newPage();
const origin = 'http://127.0.0.1:5173';

if (!live) {
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
}
await context.route('**/*@vapi-ai_web*', async route => {
  const url = new URL(route.request().url());
  if (url.searchParams.has('original')) return route.continue();
  url.searchParams.set('original', '1');
  await route.fulfill({ contentType: 'application/javascript', body: live ? `
    import Sdk from ${JSON.stringify(url.pathname + url.search)};
    const Real = Sdk.default || Sdk;
    export default { default: class extends Real {
      constructor(...args) {
        super(...args); window.__voiceEvents = [];
        this.on('error', e => window.__voiceEvents.push({event:'error', type:e?.type, stage:e?.stage}));
        this.on('message', m => { if (m.type === 'status-update') window.__voiceEvents.push({event:m.type,status:m.status,reason:m.endedReason}); });
        this.on('call-end', () => window.__voiceEvents.push({event:'call-end'}));
        window.__realClient = this;
      }
    }};
  ` : `
    export default { default: class {
      handlers = {}; muted = false;
      constructor() { window.__client = this; window.__stopCount = 0; }
      on(name, fn) { (this.handlers[name] ||= []).push(fn); }
      emit(name, data) { for (const fn of this.handlers[name] || []) fn(data); }
      async start(assistant, overrides) {
        window.__callOverrides = overrides;
        if(window.__startupWarning) this.emit('error',{type:'audio-processing-setup-error'});
        this.emit('call-start'); return {id:'test-call'};
      }
      async stop() { window.__stopCount++; this.emit('call-end'); }
      setMuted(value) {
        if (this.throwMute) throw new Error('Microphone unavailable');
        this.muted = value;
        this.emit('daily-participant-updated', {local:true,audio:!value});
        if (!value) this.emit('error', {type:'audio-processor-recovery-error', error:{message:'KrispInitError: Canceled'}});
      }
      isMuted() { return this.muted; }
    }};
  ` });
});

try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  if (!live) {
    await page.getByRole('button', {name:'Open connection settings'}).click();
    await page.getByLabel('Public key', {exact:true}).fill('test-public');
    await page.getByLabel('Assistant ID', {exact:true}).fill('test-assistant');
    await page.getByRole('button', {name:'Save connection'}).click();
  }
  await page.getByRole('button', {name:'Start conversation'}).click();
  await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible({timeout:45000});
  await page.getByRole('button', {name:'Mute microphone',exact:true}).click();
  await expect(page.getByRole('button', {name:'Unmute microphone',exact:true})).toBeVisible();
  if (live) {
    await expect.poll(() => page.evaluate(() => window.__realClient.isMuted())).toBe(true);
    console.log('Live call connected; microphone muted. Waiting 75 seconds.');
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(15000);
      if (!(await page.getByRole('button', {name:'End conversation'}).isVisible())) throw new Error('Call ended while muted');
      console.log('Muted connection held for ' + ((i + 1) * 15) + ' seconds.');
    }
  } else {
    expect(await page.evaluate(() => window.__callOverrides)).toEqual({silenceTimeoutSeconds:3600});
    await page.clock.install();
    await page.clock.fastForward(90000);
  }
  await page.getByRole('button', {name:'Unmute microphone',exact:true}).click();
  await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Mute microphone',exact:true})).toBeVisible();
  if (live) {
    await page.waitForTimeout(5000);
    await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__realClient.isMuted())).toBe(false);
    for (let i=0; i<3; i++) {
      await page.getByRole('button', {name:'Mute microphone',exact:true}).click();
      await expect.poll(() => page.evaluate(() => window.__realClient.isMuted())).toBe(true);
      await page.waitForTimeout(1000);
      await page.getByRole('button', {name:'Unmute microphone',exact:true}).click();
      await expect.poll(() => page.evaluate(() => window.__realClient.isMuted())).toBe(false);
    }
    await page.waitForTimeout(5000);
    await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible();
    console.log('PASS: real call stayed connected through 75s mute and four unmute cycles. Synthetic microphone only.');
  } else {
    expect(await page.evaluate(() => window.__stopCount)).toBe(0);
    await page.getByRole('button', {name:'Mute microphone',exact:true}).click();
    // A recovered noise processor must not silently unmute the user.
    await page.evaluate(() => {
      window.__client.muted = false;
      window.__client.emit('daily-participant-updated',{local:true,audio:true});
    });
    expect(await page.evaluate(() => window.__client.muted)).toBe(true);
    for (const type of ['audio-processing-setup-error','audio-processor-recovery-error','audio-observer-setup-error']) {
      await page.evaluate(type => window.__client.emit('error',{type}), type);
      await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible();
    }
    await page.evaluate(() => { window.__client.throwMute = true; });
    await page.getByRole('button', {name:'Unmute microphone',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Could not change the microphone state');
    await expect(page.getByRole('button', {name:'Unmute microphone',exact:true})).toBeVisible();
    await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible();
    await page.evaluate(() => { window.__client.throwMute = false; });
    await page.getByRole('button', {name:'Unmute microphone',exact:true}).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await page.evaluate(() => window.__stopCount)).toBe(0);
    // Genuine transport failures must still end the session.
    await page.evaluate(() => window.__client.emit('error',{type:'daily-error',error:{message:'Transport disconnected'}}));
    await expect(page.getByRole('button', {name:'Start conversation'})).toBeVisible();
    expect(await page.evaluate(() => window.__stopCount)).toBe(1);
    await page.evaluate(() => { window.__startupWarning = true; });
    await page.getByRole('button', {name:'Start conversation'}).click();
    await expect(page.getByRole('button', {name:'End conversation'})).toBeVisible();
    // Preserve a server timeout reason instead of replacing it with a late error.
    await page.evaluate(() => {
      window.__client.emit('message',{type:'status-update',status:'ended',endedReason:'silence-timed-out'});
      window.__client.emit('error',{type:'daily-error',error:{message:'Late transport error'}});
    });
    await expect(page.getByRole('alert')).toContainText('silence timeout');
    await expect(page.getByRole('button', {name:'Start conversation'})).toBeVisible();
    console.log('PASS: 90s mute, unmute recovery, audio warnings, mute preservation, retry, genuine failure handling, startup recovery, and server end reasons.');
  }
} catch (error) {
  console.error(live ? 'Live mute check did not pass.' : error.message);
  if (live) {
    console.log(JSON.stringify(await page.evaluate(() => {
      let detail = document.querySelector('.error-message')?.textContent || '';
      for(const input of document.querySelectorAll('input')) if(input.value) detail = detail.replaceAll(input.value, '[redacted]');
      return {events:window.__voiceEvents || [], status:document.querySelector('.session-prompt')?.textContent, detail};
    }),null,2));
  }
  process.exitCode = 1;
} finally {
  // Always end an actual call, including after an assertion failure.
  if (await page.getByRole('button', {name:'End conversation'}).isVisible().catch(() => false)) {
    await page.getByRole('button', {name:'End conversation'}).click().catch(() => {});
  }
  if (live) await page.evaluate(() => window.__realClient?.stop()).catch(() => {});
  await browser.close();
}
