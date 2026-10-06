import { test, expect, Page } from '@playwright/test';

/**
 * Verificações sensíveis ao iPhone, rodadas no WebKit (o motor de todo
 * navegador no iOS) nos projetos "iPhone 14" e "iPhone SE" (320×568, a tela
 * mais apertada). O Chromium cobre o resto da suíte.
 */

const overflow = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('.pokemon-detail__content') as HTMLElement;
    return c.scrollHeight - c.clientHeight;
  });
const sheetHeight = (page: Page) =>
  page.evaluate(() =>
    Math.round(document.querySelector('.p-dialog')!.getBoundingClientRect().height),
  );

/** Grade pronta: carregamento terminou e a tela parou de esticar. */
async function gridSettled(page: Page) {
  await expect(page.locator('app-pokemon-card .card').first()).toBeVisible();
  await expect(page.locator('app-screen-intro')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('.pokedex__results')!.getAnimations().length),
    )
    .toBe(0);
}

test('iPhone: abre pronto e o toque no card (não na imagem) abre o detalhe', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await gridSettled(page);
  const first = page.locator('app-pokemon-card .card').first();
  await expect(first).toHaveClass(/type-grass/);
  expect(
    await first.locator('img').evaluate((i) => (i as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);

  const card = page.locator('app-pokemon-card .card').nth(3);
  await card.scrollIntoViewIfNeeded();
  const box = (await card.locator('img').boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)!.tagName, [x, y]);
  expect(hit).not.toBe('IMG');
  await page.touchscreen.tap(x, y);
  await expect(page.locator('.detail__name')).toHaveText('Charmander');
  expect(errors).toEqual([]);
});

test('iPhone: detalhe sem rolagem e painel com altura fixa nas duas abas', async ({ page }) => {
  // #342 e #303: as maiores descrições (no iPhone SE ligam o modo compacto)
  for (const id of ['342', '303', '6']) {
    await page.goto('/pokemon/' + id);
    await expect(page.locator('.detail__flavor')).toBeVisible();
    await expect.poll(() => overflow(page), { message: `#${id} sobre` }).toBeLessThanOrEqual(0);
    const onSobre = await sheetHeight(page);

    await page.getByRole('tab', { name: 'Status' }).tap();
    await expect(page.locator('app-stat-hexagon .hex__total')).toBeVisible();
    await expect.poll(() => overflow(page), { message: `#${id} status` }).toBeLessThanOrEqual(0);
    expect(await sheetHeight(page)).toBe(onSobre);
  }
});

test('iPhone: fechar o detalhe mantém a posição na lista', async ({ page }) => {
  await page.goto('/');
  await gridSettled(page);
  const mew = page.locator('app-pokemon-card .card', { hasText: 'Mew' }).last();
  await mew.evaluate((el) =>
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(5000);
  const before = await page.evaluate(() => window.scrollY);

  await mew.tap();
  await expect(page.locator('.detail__name')).toHaveText('Mew');
  await page.getByRole('button', { name: 'Fechar' }).tap();
  await expect(page.locator('.p-dialog')).toHaveCount(0);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(5);
});
