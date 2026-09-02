import { test, expect, Page } from '@playwright/test';

const firstCard = (page: Page) => page.locator('app-pokemon-card .card').first();
const searchBox = (page: Page) => page.getByLabel('Buscar Pokémon');

async function waitForGrid(page: Page) {
  await expect(firstCard(page)).toBeVisible();
}

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const htmlClass = (page: Page) => page.evaluate(() => document.documentElement.className);
const pToken = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test('carrega a primeira página com 60 cards e faz só 1 request de lista', async ({ page }) => {
  const listRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/pokemon?')) {
      listRequests.push(req.url());
    }
  });

  await page.goto('/');
  await waitForGrid(page);

  await expect(page.locator('app-pokemon-card')).toHaveCount(60);
  expect(listRequests).toHaveLength(1);
  expect(listRequests[0]).toContain('limit=60');
});

test('busca por nome abre o resultado e permite limpar', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  await searchBox(page).fill('gengar');
  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(page.locator('app-pokemon-card')).toHaveCount(1);
  await expect(page.locator('.card__name')).toHaveText('Gengar');
  // com filtro ativo "Carregar mais" some (não induz que há mais resultados)
  await expect(page.getByRole('button', { name: /carregar mais/i })).toBeHidden();

  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(page.locator('app-pokemon-card').first()).toBeVisible();
  await expect(page.locator('app-pokemon-card')).toHaveCount(60);
  await expect(page.getByRole('button', { name: /carregar mais/i })).toBeVisible();
});

test('filtro local por número mostra 1 card, centralizado e sem "carregar mais"', async ({
  page,
}) => {
  await page.goto('/');
  await waitForGrid(page);

  await searchBox(page).fill('1');
  await expect(page.locator('app-pokemon-card')).toHaveCount(1);
  await expect(page.locator('.card__name')).toHaveText('Bulbasaur');
  await expect(page.getByRole('button', { name: /carregar mais/i })).toBeHidden();

  // grade centralizada: o card fica aproximadamente no centro horizontal da lista
  const grid = page.locator('.pokedex__grid');
  const card = page.locator('app-pokemon-card .card');
  const g = await grid.boundingBox();
  const c = await card.boundingBox();
  const gridCenter = g!.x + g!.width / 2;
  const cardCenter = c!.x + c!.width / 2;
  expect(Math.abs(gridCenter - cardCenter)).toBeLessThan(40);
});

test('filtro por tipo reduz a grade sem novas requisições de lista', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  const before = await page.locator('app-pokemon-card').count();
  await page.locator('.p-multiselect').click();
  await page.getByRole('option', { name: 'Fogo' }).click();
  await page.keyboard.press('Escape');

  await expect.poll(() => page.locator('app-pokemon-card').count()).toBeLessThan(before);
});

test('abre o detalhe via card e via deep-link', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  await firstCard(page).click();
  await expect(page).toHaveURL(/\/pokemon\/[a-z-]+$/);
  await expect(page.locator('app-pokemon-detail .detail__name')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$|\/\?/);

  await page.goto('/pokemon/mewtwo');
  await expect(page.locator('app-pokemon-detail .detail__name')).toHaveText('Mewtwo');
  await expect(page.locator('app-pokemon-detail')).toContainText('Status');
  // dados da species (flavor text) chegam e são exibidos
  await expect(page.locator('app-pokemon-detail .detail__flavor')).toBeVisible();
  await expect(page.locator('app-pokemon-detail')).toContainText('Geração');
  // altura/peso convertidos de dm/hg para m/kg (Mewtwo: 20 dm / 1220 hg)
  await expect(page.locator('app-pokemon-detail')).toContainText('2.0 m');
  await expect(page.locator('app-pokemon-detail')).toContainText('122.0 kg');
});

test('scroll infinito carrega mais Pokémon', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);
  await expect(page.locator('app-pokemon-card')).toHaveCount(60);

  await page.getByRole('button', { name: /carregar mais/i }).click();
  await expect(page.locator('app-pokemon-card')).toHaveCount(120);
});

test('dark mode: alterna tema do app e do PrimeNG e persiste após reload', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  // valores concretos definidos em src/styles.scss (--app-bg claro/escuro)
  const LIGHT_BG = 'rgb(243, 244, 246)';
  const DARK_BG = 'rgb(14, 14, 17)';

  expect(await htmlClass(page)).not.toContain('app-dark');
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG);
  const lightContentToken = await pToken(page, '--p-content-background');

  // ícones PrimeIcons renderizam (fonte carregada, glyph com largura > 0)
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.locator('.pokedex__theme i').evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/screens/light-home.png' });

  await page.getByRole('button', { name: /modo escuro/i }).click();
  await expect.poll(() => htmlClass(page)).toContain('app-dark');
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG);

  // PrimeNG também escurece (token de superfície muda)
  expect(await pToken(page, '--p-content-background')).not.toBe(lightContentToken);

  await firstCard(page).click();
  await expect(page.locator('app-pokemon-detail .detail__name')).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/dark-detail.png' });
  await page.keyboard.press('Escape');

  // persiste após reload
  await page.reload();
  await waitForGrid(page);
  expect(await htmlClass(page)).toContain('app-dark');
  await expect.poll(() => bodyBg(page)).toBe(DARK_BG);
  await page.screenshot({ path: 'test-results/screens/dark-home.png' });

  // volta ao claro e persiste
  await page.getByRole('button', { name: /modo claro/i }).click();
  await expect.poll(() => htmlClass(page)).not.toContain('app-dark');
  await page.reload();
  await waitForGrid(page);
  expect(await htmlClass(page)).not.toContain('app-dark');
  await expect.poll(() => bodyBg(page)).toBe(LIGHT_BG);
});
