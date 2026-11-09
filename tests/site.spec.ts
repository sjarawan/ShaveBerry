import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Keep the suite local, including subresources and accidental navigation.
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:4173') {
      return route.continue();
    }
    return route.abort();
  });
});

async function openNavigation(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Toggle menu' }).click();
}

test('homepage loads at both supported entry points', async ({ page }) => {
  for (const path of ['/', '/index.html']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Shave Berry/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Naturally delicious.');
    await expect(page.getByRole('navigation')).toBeVisible();
  }
});

test('main navigation reaches each section and the game', async ({ page, isMobile }) => {
  await page.goto('/');
  for (const [name, id] of [['Menu', 'menu'], ['Schedule', 'schedule'], ['Our Story', 'about'], ['Book Our Trailer', 'events']]) {
    await openNavigation(page, isMobile);
    await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
  await openNavigation(page, isMobile);
  await page.getByRole('navigation').getByRole('link', { name: /Berry Bounce/ }).click();
  await expect(page).toHaveURL(/\/game.html$/);
  await expect(page.getByRole('button', { name: 'Play!', exact: true })).toBeVisible();
});

test('menu can be reached with the keyboard and its content is visible', async ({ page, isMobile }) => {
  await page.goto('/');
  await openNavigation(page, isMobile);
  await page.getByRole('navigation').getByRole('link', { name: 'Menu', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#menu$/);
  const heading = page.getByRole('heading', { name: 'One dessert. Perfected.' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
});

test('carousel buttons, dots, wrapping, and keyboard navigation work', async ({ page }) => {
  await page.goto('/');
  const gallery = page.locator('#trailerCarousel');
  await gallery.scrollIntoViewIfNeeded();
  await gallery.focus();
  const assertSlide = async (number: number) => {
    await expect(gallery.locator('.carousel-slide.is-active')).toHaveAttribute('aria-label', `${number} of 5`);
    await expect(gallery.getByRole('tab', { selected: true })).toHaveAccessibleName(`Go to slide ${number}`);
    await expect(gallery.locator('.carousel-slide:not(.is-active)')).toHaveCount(4);
    await expect(gallery.locator('.carousel-slide.is-active')).not.toHaveAttribute('aria-hidden', 'true');
  };
  await assertSlide(1);
  await gallery.getByRole('button', { name: 'Next slide' }).click();
  await assertSlide(2);
  await gallery.getByRole('button', { name: 'Previous slide' }).click();
  await assertSlide(1);
  await gallery.getByRole('button', { name: 'Previous slide' }).click();
  await assertSlide(5);
  await gallery.getByRole('button', { name: 'Next slide' }).click();
  await assertSlide(1);
  await gallery.getByRole('tab', { name: 'Go to slide 3' }).click();
  await assertSlide(3);
  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await assertSlide(4);
  await page.keyboard.press('ArrowLeft');
  await assertSlide(3);
});

test('mobile navigation opens, closes, and closes after choosing a link', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile viewport interaction');
  await page.goto('/');
  const links = page.locator('#navLinks');
  const toggle = page.getByRole('button', { name: 'Toggle menu' });
  await expect(links).toBeHidden();
  await toggle.click();
  await expect(links).toBeVisible();
  await toggle.click();
  await expect(links).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(links).toBeVisible();
  await links.getByRole('link', { name: 'Menu', exact: true }).click();
  await expect(page).toHaveURL(/#menu$/);
  await expect(links).toBeHidden();
});

test('logos and every carousel image decode successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('img')).toHaveCount(8);
  for (const image of await page.locator('img').all()) {
    // Scrolling also triggers native lazy loading for gallery and footer images.
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('alt', /\S/);
    await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
      element.complete && element.naturalWidth > 0 && element.naturalHeight > 0
    )).toBe(true);
  }
});

test('Berry Bounce loads, initializes the canvas, and links home', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('/game.html');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Berry Bounce/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Berry Bounce');
  await expect(page.locator('#gameCanvas')).toBeVisible();
  expect(await page.locator('#gameCanvas').evaluate((canvas: HTMLCanvasElement) =>
    canvas.width > 0 && canvas.height > 0 && canvas.getContext('2d') !== null
  )).toBe(true);
  await expect(page.getByRole('button', { name: 'Play!', exact: true })).toBeVisible();
  await page.locator('#startScreen').getByRole('link', { name: /shaveberry.com/ }).click();
  await expect(page).toHaveURL(/\/index.html$/);
  expect(errors).toEqual([]);
});
