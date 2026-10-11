import { expect, test, type Page } from '@playwright/test';
import { E2E_API_URL } from '../playwright.config';

/** Tab screens stay mounted on the web, so shared widgets exist once per tab: use the visible one. */
const visible = (page: Page, testId: string) => page.getByTestId(testId).filter({ visible: true });

async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).click();
}

async function logWorkout(page: Page, opts: { name: string; exercise: string; weight: string; reps: string }) {
  await openTab(page, 'Today');
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await expect(page.getByTestId('workout-editor')).toBeVisible();
  await page.getByLabel('Workout name').fill(opts.name);
  await page.getByTestId('add-exercise').click();
  await page.getByLabel('Search exercises').fill(opts.exercise.split(' ')[0]!);
  await page.getByRole('button', { name: `Add ${opts.exercise}` }).click();
  await page.getByLabel(`${opts.exercise} set 1 weight (kg)`).fill(opts.weight);
  await page.getByLabel(`${opts.exercise} set 1 reps`).fill(opts.reps);
  await page.getByTestId('save-workout').click();
}

test('demo: log a PR, keep logging offline, sync on reconnect, see progress', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();

  // Seeded demo account: live streak, routines and recent PRs.
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await expect(page.getByTestId('day-streak')).toContainText(/\d+ days/);
  await expect(page.getByTestId('recent-prs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Push Day' })).toBeVisible();
  await expect(visible(page, 'sync-status')).toContainText('Synced');

  // Online: a heavy bench set is a new personal record and syncs straight away.
  await logWorkout(page, { name: 'E2E heavy bench', exercise: 'Bench Press', weight: '100', reps: '3' });
  const saved = visible(page, 'saved-banner');
  await expect(saved).toContainText('Workout saved');
  await expect(saved).toContainText('Bench Press: Heaviest weight 100 kg');
  await expect(saved).toContainText('Synced to your account', { timeout: 30_000 });

  // Offline: logging still works and the change waits in the outbox.
  await context.setOffline(true);
  await expect(visible(page, 'offline-banner')).toBeVisible();
  await logWorkout(page, { name: 'E2E offline deadlifts', exercise: 'Deadlift', weight: '150', reps: '5' });
  await expect(visible(page, 'saved-banner')).toContainText('Saved on this device');
  await expect(visible(page, 'sync-status')).toContainText('Offline · 1 pending');

  // Reconnect: the queue drains on its own.
  await context.setOffline(false);
  await expect(visible(page, 'offline-banner')).toBeHidden();
  await expect(visible(page, 'sync-status')).toContainText('Synced', { timeout: 30_000 });

  // Both workouts really are on the server.
  const token = await page.evaluate(() => window.localStorage.getItem('fittrack.token'));
  const response = await page.request.get(`${E2E_API_URL}/sync/changes`, { headers: { authorization: `Bearer ${token}` } });
  expect(response.ok()).toBe(true);
  const names = ((await response.json()) as { workouts: { name: string }[] }).workouts.map((w) => w.name);
  expect(names).toEqual(expect.arrayContaining(['E2E heavy bench', 'E2E offline deadlifts']));

  // Progress charts render from local data, including the new PR.
  await openTab(page, 'Progress');
  await expect(page.getByTestId('exercise-chart')).toBeVisible();
  await expect(page.getByTestId('volume-chart')).toBeVisible();
  await expect(page.getByTestId('records-table')).toContainText('Bench Press');
});

test('new account: validation, empty states and a first workout', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Tell us your name')).toBeVisible();
  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();

  const email = `e2e-${Date.now()}@example.com`;
  await page.getByLabel('Name').fill('Robin E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByTestId('today-screen')).toBeVisible();
  await expect(page.getByText('Log your first workout')).toBeVisible();

  // Saving an incomplete workout is blocked with a clear message.
  await page.getByRole('button', { name: 'Start empty workout' }).click();
  await page.getByTestId('save-workout').click();
  await expect(page.getByTestId('workout-errors')).toContainText('Add at least one exercise');

  await page.getByTestId('add-exercise').click();
  await page.getByRole('button', { name: 'Add Back Squat' }).click();
  await page.getByLabel('Back Squat set 1 weight (kg)').fill('60');
  await page.getByLabel('Back Squat set 1 reps').fill('5');
  await page.getByTestId('save-workout').click();
  await expect(visible(page, 'saved-banner')).toContainText('Workout saved');
  await expect(page.getByTestId('history-screen')).toContainText('Back Squat');

  // Signing out returns to the welcome screen and clears local data.
  await openTab(page, 'Settings');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('welcome-screen')).toBeVisible();
});
