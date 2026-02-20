import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Ordio smoke tests', () => {
  test('idle state renders correctly', async ({ page }) => {
    await page.goto('/');

    // Logo visible
    await expect(page.locator('h1').filter({ hasText: 'ord' })).toBeVisible();

    // Record button visible and accessible
    const recordBtn = page.getByRole('button', { name: 'Start recording' });
    await expect(recordBtn).toBeVisible();

    // Upload link hidden until hover (opacity-0)
    const uploadBtn = page.getByRole('button', { name: 'Upload audio file' });
    await expect(uploadBtn).toBeAttached(); // exists in DOM
  });

  test('file upload transitions to export state', async ({ page }) => {
    await page.goto('/');

    // Trigger file input with a tiny valid WAV fixture
    const wavPath = path.join(__dirname, 'fixtures', 'silence.wav');

    // Attach file to the hidden input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(wavPath);

    // Should enter processing state
    await expect(page.getByText('Creating your video')).toBeVisible({ timeout: 5_000 });

    // Should eventually reach export state
    await expect(page.getByText('Ready to share')).toBeVisible({ timeout: 15_000 });

    // Export button should be present
    await expect(page.getByRole('button', { name: 'Export video' })).toBeVisible();
  });

  test('waveform style selector appears on hover', async ({ page }) => {
    await page.goto('/');

    // Hover over the page to reveal controls
    await page.mouse.move(400, 400);

    // Waveform style buttons should become visible
    await expect(page.getByRole('button', { name: 'Bar waveform' })).toBeVisible({ timeout: 2_000 });
  });

  test('create another resets to idle', async ({ page }) => {
    await page.goto('/');

    const wavPath = path.join(__dirname, 'fixtures', 'silence.wav');
    await page.locator('input[type="file"]').setInputFiles(wavPath);

    await expect(page.getByText('Ready to share')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Create another video' }).click();

    // Back to idle — record button visible again
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({ timeout: 3_000 });
  });
});
