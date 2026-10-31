// Kohu Founders (/founders/): the founder's day planner with Kō, from the Claude Design file "Ko Phone".
import { test, expect } from './helpers.mjs';

const nav = (page, i) => page.locator('nav button').nth(i);

test('onboarding signs in, connects OpenRouter and lands on Kō, then Today', async ({ page }) => {
  await page.goto('/founders/');
  await expect(page.locator('.k-signal-stage canvas').first()).toBeAttached();
  await page.getByText('Continue with Google Workspace').click();
  await page.getByText('hello@kohulabs.com').first().click();
  await page.getByRole('button', { name: 'Allow' }).click();
  await expect(page.getByText('João Duarte')).toBeVisible();
  await page.getByRole('button', { name: 'Connect OpenRouter' }).click();
  await page.getByRole('button', { name: 'Authorize' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Plan my day' }).click();

  // Home is Kō alone; tapping him opens the tiles.
  await expect(page.getByText('tap him')).toBeVisible();
  await page.locator('.k-signal-stage').first().click({ force: true });
  await page.getByRole('button', { name: /^Today/ }).first().click();
  await expect(page.getByText('17 chunks left.')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).first().click();
  await expect(page.getByText('16 chunks left.')).toBeVisible();

  // A reload skips onboarding.
  await page.reload();
  await expect(page.getByText('tap him')).toBeVisible();
});

test('Kō answers in chat and fits a fed task into the day', async ({ page }) => {
  await page.goto('/founders/?screen=ko');
  await page.getByRole('button', { name: 'What’s next?' }).click();
  await expect(page.getByText('Metrics section, 25 minutes.')).toBeVisible();
  await page.getByPlaceholder('Ask Kō or give him a task').fill('book flights for the summit');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Added “Book flights for the summit”. One 25 min chunk at 20:30. In Personal.')).toBeVisible();
});

test('stats, spend, inbox and settings open from the nav, and PT switches the copy', async ({ page }) => {
  await page.goto('/founders/?screen=home&homeVariant=timeline');
  await nav(page, 1).click();
  await expect(page.getByText('38 chunks.')).toBeVisible();
  await page.getByRole('button', { name: 'Spend' }).click();
  await expect(page.getByText('$48.20 this month.')).toBeVisible();
  await nav(page, 3).click();
  await expect(page.getByText('Ship the pricing page Friday or Monday?')).toBeVisible();
  await nav(page, 4).click();
  await expect(page.getByText('hello@kohulabs.com')).toBeVisible();
  await page.getByRole('button', { name: 'PT', exact: true }).first().click();
  await expect(page.getByText('Terminar sessão')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
});

// The Android app (android/) loads the same page with window.KohuAndroid; this stands in for it.
test('in the Android app: full screen, Kō sets the phone alarm, and back steps through the screens', async ({ page }) => {
  await page.addInitScript(() => {
    window.alarms = [];
    window.KohuAndroid = { platform: () => 'android', setAlarm: (h, m, label) => { window.alarms.push([h, m, label]); return true; } };
  });
  await page.goto('/founders/?screen=home');
  await expect(page.locator('html')).toHaveClass(/kf-native/);
  await expect(page.locator('.kf-status')).toBeHidden();
  const back = () => page.evaluate(() => window.kohuFounders.back());

  // Kō's home: open him, open Stats › Spend, then back out step by step.
  await page.locator('.k-signal-stage').first().click({ force: true });
  await page.getByRole('button', { name: /^Today/ }).first().click();
  await nav(page, 1).click();
  await page.getByRole('button', { name: 'Spend' }).click();
  expect(await back()).toBe(true);
  await expect(page.getByText('38 chunks.')).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.getByText('tap him')).toBeVisible();
  expect(await back()).toBe(false); // on Kō's home, back leaves the app

  // You › Alarms › Ask Kō to set one: the reply, and the alarm on the phone.
  await nav(page, 4).click();
  await page.getByRole('button', { name: '2 on ›' }).click();
  await page.getByRole('button', { name: 'Ask Kō to set one' }).click();
  await expect(page.getByText('Done. Alarm at 06:45 tomorrow')).toBeVisible();
  expect(await page.evaluate(() => window.alarms)).toEqual([[6, 45, 'Run before work']]);
});

// In the Android app the day comes from the phone's database (FoundersStore.kt) and every change goes back to it.
// This stands in for the store: it serves a small stored day and records what the screens write.
test('in the Android app: the day comes from the phone database and changes are saved to it', async ({ page }) => {
  await page.addInitScript(() => {
    const stored = {
      chunks: [
        { id: 'k1', ws: 'kohu', start: '09:00', minutes: 25, title: 'Board deck: outline', category: 'inv', status: 'done', startedAt: null },
        { id: 'k2', ws: 'kohu', start: '09:30', minutes: 25, title: 'Board deck: numbers', category: 'inv', status: 'planned', startedAt: Date.now() - 300_000 },
        { id: 'p1', ws: 'personal', start: '18:00', minutes: 15, title: 'Call the bank', category: 'admin', status: 'planned', startedAt: null }
      ],
      goals: [{ id: 'g1', ws: 'kohu', title: 'Send the board deck', done: false }],
      nudges: [{ id: 'n1', ws: 'kohu', kind: 'Decision', tone: 'decision', time: '08:10', title: 'Board meeting Tuesday or Thursday?', body: 'Both are free.', actions: ['Tuesday', 'Thursday'], go: null }],
      followUps: [], alarms: [], messages: [{ who: 'user', ws: 'general', text: 'What’s next?', key: null }, { who: 'ko', ws: 'general', text: null, key: 'next' }],
      review: null, settings: { mode: '"kohu"' }, workspaces: []
    };
    window.ops = [];
    window.KohuAndroid = {
      platform: () => 'android', setAlarm: () => true,
      today: (date, lang) => { window.asked = [date, lang]; return JSON.stringify({ date, ...stored }); },
      apply: (json) => { const list = JSON.parse(json); window.ops.push(...list); return JSON.stringify({ ids: Object.fromEntries(list.filter((o) => o.op === 'add').map((o) => [o.clientId, 'db-' + o.clientId])) }); }
    };
  });
  await page.goto('/founders/?screen=home&homeVariant=timeline');
  const asked = await page.evaluate(() => window.asked);
  expect(asked[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // The stored day, in the stored tab (Kohu), with today's date and the timer already 5 minutes in.
  await expect(page.getByText('1 chunks left.')).toBeVisible();
  await expect(page.getByText('Board deck: numbers').first()).toBeVisible();
  await expect(page.getByText('Call the bank')).toHaveCount(0);
  const d = new Date(), short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  await expect(page.getByText(new RegExp(`^${short} ${d.getDate()} `)).first()).toBeVisible();
  await expect(page.getByText(/^20:0\d left$/).first()).toBeVisible();

  // Mark it done, tick the goal, answer the nudge: each is written to the store.
  await page.getByRole('button', { name: 'Done', exact: true }).first().click();
  await page.getByText('Send the board deck').click();
  await page.locator('nav button').nth(3).click();
  await page.getByRole('button', { name: 'Thursday' }).click();
  await expect.poll(() => page.evaluate(() => window.ops.map((o) => `${o.op}:${o.id || o.key}`))).toEqual(expect.arrayContaining(['started:k2', 'chunk:k2', 'goal:g1', 'nudge:n1']));
  const ops = await page.evaluate(() => window.ops);
  expect(ops.find((o) => o.op === 'chunk')).toMatchObject({ id: 'k2', status: 'done' });
  expect(ops.find((o) => o.op === 'nudge')).toMatchObject({ answer: 'Thursday' });

  // Kō keeps today's chat (without the design's scripted answers); a task you give him is added to the store.
  await page.getByRole('button', { name: 'General' }).first().click();
  await page.locator('nav button').nth(2).click();
  await expect(page.getByText('What’s next?', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Metrics section, 25 minutes.')).toHaveCount(0);
  await page.getByPlaceholder('Ask Kō or give him a task').fill('add: renew my passport');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.ops.filter((o) => o.op === 'add').length)).toBe(1);
  expect((await page.evaluate(() => window.ops)).find((o) => o.op === 'add')).toMatchObject({ clientId: 'f0', ws: 'personal', title: 'Renew my passport', minutes: 25 });
  expect((await page.evaluate(() => window.ops)).filter((o) => o.op === 'setting').map((o) => o.key)).toContain('mode');
});


// Phase 0: in the app, nothing the design invented is shown; what is not built yet is hidden, the rest is real.
test('in the Android app: only true things are shown, and Kō only says what it knows', async ({ page }) => {
  await page.addInitScript(() => {
    const day = new Date(), pad = (n) => String(n).padStart(2, '0'), today = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const stored = {
      chunks: [
        { id: 'cal:a', ws: 'kohu', start: '09:30', minutes: 30, title: 'Board call', category: 'meet', status: 'done', startedAt: null },
        { id: 'k2', ws: 'kohu', start: '11:00', minutes: 25, title: 'Pricing copy', category: 'fed', status: 'planned', startedAt: null },
        { id: 'cal:b', ws: 'kohu', start: '15:00', minutes: 60, title: 'Investor sync', category: 'meet', status: 'planned', startedAt: null }
      ],
      goals: [], nudges: [], alarms: [], messages: [], review: null, settings: { mode: '"kohu"' }, workspaces: [],
      followUps: [{ id: 'gm:18abc', ws: 'kohu', person: 'Ana Reis', what: 'Deck follow-up', direction: 'you', days: 1, source: 'Gmail', nudged: false }]
    };
    window.alarms = []; window.opened = [];
    window.KohuAndroid = {
      platform: () => 'android', today: (date) => JSON.stringify({ date, ...stored }), apply: () => JSON.stringify({ ids: {} }),
      setAlarm: (h, m, label) => { window.alarms.push([h, m, label]); return true; },
      week: () => JSON.stringify({ days: Array.from({ length: 7 }, (_, i) => ({ date: i === 2 ? today : `x${i}`, done: i === 2 ? 3 : i === 0 ? 1 : 0, minutes: i === 2 ? 90 : i === 0 ? 25 : 0 })) })
    };
  });
  const nav = (i) => page.locator('nav button').nth(i);
  await page.goto('/founders/?screen=home&homeVariant=timeline');

  // Today: real chunks and meetings; no focus guard, no fake "synced from" line, no pretend mic.
  await expect(page.getByText('Pricing copy').first()).toBeVisible();
  await expect(page.getByText('Meeting · 60 min · Calendar')).toBeVisible();
  await expect(page.getByText(/Focus guard/)).toHaveCount(0);
  await expect(page.getByText(/Synced from/)).toHaveCount(0);

  // Kō: a greeting from the real day, honest answers, a real alarm at the time asked.
  await nav(2).click();
  await expect(page.getByText('Hi. 2 of 3 chunks left today, 1 of them meetings.')).toBeVisible();
  await expect(page.getByText('Kō · no AI yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mic' })).toHaveCount(0);
  await page.getByRole('button', { name: 'What’s next?' }).click();
  await expect(page.getByText('Now: Pricing copy, 25 min. Then Investor sync at 15:00.')).toBeVisible();
  const input = page.getByPlaceholder('Ask Kō or give him a task');
  await input.fill('wake me at 6:30'); await page.keyboard.press('Enter');
  await expect(page.getByText('Done: an alarm at 06:30 in your Clock app.')).toBeVisible();
  expect(await page.evaluate(() => window.alarms)).toEqual([[6, 30, 'Kō alarm']]);
  await input.fill('write the board memo'); await page.keyboard.press('Enter');
  await expect(page.getByText(/^I can’t answer that yet/)).toBeVisible();

  // Stats: this week from the database; no Spend tab.
  await nav(1).click();
  await expect(page.getByText('4 chunks done.')).toBeVisible();
  await expect(page.getByText('1.9 hours of focus.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spend' })).toHaveCount(0);
  await expect(page.getByText('38 chunks.')).toHaveCount(0);

  // Follow-ups: real Gmail threads open in Gmail.
  await nav(3).click();
  await page.getByRole('button', { name: 'Follow-ups' }).click();
  await expect(page.getByText('Deck follow-up')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft reply' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open in Gmail' })).toBeVisible();

  // Settings: only what exists.
  await nav(4).click();
  await expect(page.getByText('Senders and subjects')).toBeVisible();
  for (const gone of ['Tools (MCP)', 'Wake phrases', 'Try a wake-up', 'OpenRouter key', 'Monthly cap']) await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
});

// Kō's home message, pull to refresh, and voice (the app's KohuBridge stood in for).
test('in the Android app: Kō’s home says what is planned and waiting; pull to refresh; voice into the task box', async ({ page }) => {
  await page.addInitScript(() => {
    const stored = {
      chunks: [{ id: 'cal:a', ws: 'kohu', start: '15:00', minutes: 60, title: 'Investor sync', category: 'meet', status: 'planned', startedAt: null },
        { id: 'k2', ws: 'kohu', start: '11:00', minutes: 25, title: 'Pricing copy', category: 'fed', status: 'planned', startedAt: null }],
      goals: [], nudges: [], alarms: [], messages: [], review: null, settings: { mode: '"general"' }, workspaces: [],
      followUps: [{ id: 'gm:1', ws: 'kohu', person: 'Ana', what: 'Deck', direction: 'you', days: 0, source: 'Gmail', nudged: false },
        { id: 'gm:2', ws: 'kohu', person: 'Rui', what: 'IVA', direction: 'you', days: 1, source: 'Gmail', nudged: false }]
    };
    window.calls = [];
    window.KohuAndroid = {
      platform: () => 'android', today: (date) => JSON.stringify({ date, ...stored }), apply: () => JSON.stringify({ ids: {} }), setAlarm: () => true,
      refresh: () => { window.calls.push('refresh'); }, canListen: () => true, listen: (lang) => { window.calls.push('listen:' + lang); }
    };
  });
  await page.goto('/founders/?screen=home');
  const note = page.locator('.kf-note');
  await expect(note).toHaveText('Today: 2 chunks left, next meeting 15:00 Investor sync. 2 emails waiting on you.');

  // Pull down from the top: the pill follows, a release past the line asks the phone to refresh, Kō thinks.
  const box = await page.locator('#app').boundingBox();
  const swipe = (dy) => page.evaluate(async ({ x, y, dy }) => {
    const el = document.querySelector('.kf-scroll');
    const t = (yy) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })];
    el.dispatchEvent(new TouchEvent('touchstart', { touches: t(y), bubbles: true }));
    for (let i = 1; i <= 5; i++) el.dispatchEvent(new TouchEvent('touchmove', { touches: t(y + dy * i / 5), bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
  }, { x: box.x + box.width / 2, y: box.y + 120, dy });
  await swipe(40);
  expect(await page.evaluate(() => window.calls)).toEqual([]);      // not far enough
  await swipe(140);
  expect(await page.evaluate(() => window.calls)).toEqual(['refresh']);
  await expect(page.locator('.kf-pull')).toHaveText('Checking Calendar and Gmail');
  await expect(page.getByText('Checking Calendar and Gmail').nth(1)).toBeVisible();   // Kō's own line
  // Nothing new came in: "Up to date", then the pill goes.
  await page.evaluate(() => window.kohuFounders.refreshed({ ok: true, pulled: 0 }));
  await expect(page.locator('.kf-pull')).toHaveText('Up to date');
  await expect(page.locator('.kf-pull')).toHaveCount(0, { timeout: 5000 });
  // No connection: Kō says so in its message.
  await page.evaluate(() => { window.kohuFounders.refreshNow(); window.kohuFounders.refreshed({ ok: false, error: 'offline', pulled: 0 }); });
  await expect(page.locator('.kf-pull')).toHaveText('No connection');
  await expect(note).toContainText('I couldn’t reach Google just now.');

  // Voice: the mic asks the phone to listen, and what was heard lands in the task box.
  await note.click();
  await page.getByRole('button', { name: 'Personal' }).first().click();
  await page.getByRole('button', { name: 'Mic' }).click();
  expect(await page.evaluate(() => window.calls)).toContain('listen:en');
  await page.evaluate(() => window.kohuFounders.heard('call the bank tomorrow morning'));
  await expect(page.getByPlaceholder('A task, in your own words')).toHaveValue('call the bank tomorrow morning');
});
