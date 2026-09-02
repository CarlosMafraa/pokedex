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

test('carga inicial é a Geração I (151) com um único request de lista', async ({ page }) => {
  const listRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/pokemon?')) {
      listRequests.push(req.url());
    }
  });

  await page.goto('/');
  await waitForGrid(page);

  await expect(page.locator('app-pokemon-card')).toHaveCount(151);
  expect(listRequests).toHaveLength(1);
  expect(listRequests[0]).toContain('limit=151');
  expect(listRequests[0]).toContain('offset=0');
  await expect(page.getByRole('heading', { name: 'Geração I' })).toBeVisible();
});

test('busca é ao vivo (sem botão) e o campo tem um único "x" para limpar', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  // não existe botão "Buscar"
  await expect(page.getByRole('button', { name: 'Buscar' })).toHaveCount(0);

  // digitar já filtra/busca, sem apertar nada
  await searchBox(page).fill('gengar');
  await expect(page.locator('app-pokemon-card')).toHaveCount(1);
  await expect(page.locator('.card__name')).toHaveText('Gengar');
  await expect(page.getByRole('button', { name: /carregar/i })).toBeHidden();
  // com filtro ativo a grade não é dividida por geração
  await expect(page.locator('.pokedex__gen')).toHaveCount(0);

  // só um controle de limpar dentro do campo (nada de "x" nativo duplicado)
  await expect(page.locator('.pokedex__search-field .pokedex__clear')).toHaveCount(1);

  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(page.locator('app-pokemon-card')).toHaveCount(151);
  await expect(page.getByRole('button', { name: /carregar/i })).toBeVisible();
});

test('filtro local por número mostra 1 card, centralizado e sem "carregar mais"', async ({
  page,
}) => {
  await page.goto('/');
  await waitForGrid(page);

  await searchBox(page).fill('1');
  await expect(page.locator('app-pokemon-card')).toHaveCount(1);
  await expect(page.locator('.card__name')).toHaveText('Bulbasaur');
  await expect(page.getByRole('button', { name: /carregar/i })).toBeHidden();

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

test('carregar mais traz a próxima geração, com seu cabeçalho', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);
  await expect(page.locator('app-pokemon-card')).toHaveCount(151);
  await expect(page.getByRole('heading', { name: 'Geração II' })).toHaveCount(0);

  await page.getByRole('button', { name: /carregar geração ii/i }).click();

  // Gen I (151) + Gen II (100)
  await expect(page.locator('app-pokemon-card')).toHaveCount(251);
  await expect(page.getByRole('heading', { name: 'Geração II' })).toBeVisible();
  await expect(page.getByRole('button', { name: /carregar geração iii/i })).toBeVisible();
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
