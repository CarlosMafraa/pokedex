import { test, expect, Page } from '@playwright/test';

const firstCard = (page: Page) => page.locator('app-pokemon-card .card').first();
const searchBox = (page: Page) => page.getByLabel('Buscar Pokémon');

/** Grade pronta para uso: o carregamento da tela já terminou. */
async function waitForGrid(page: Page) {
  await expect(firstCard(page)).toBeVisible();
  await expect(page.locator('app-screen-intro')).toHaveCount(0);
}

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const htmlClass = (page: Page) => page.evaluate(() => document.documentElement.className);
const pToken = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test('carga inicial: um único request com a lista nacional e a aba Geração I aberta', async ({
  page,
}) => {
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
  expect(listRequests[0]).toContain('limit=1025');
  expect(listRequests[0]).toContain('offset=0');
  await expect(page.locator('.pokedex__gen')).toHaveText('Geração I · #001–#151');
  await expect(page.getByRole('tab', { name: /Geração I,/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
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
  // a busca por texto vale para todas as gerações
  await expect(page.locator('.pokedex__gen')).toHaveText('Busca em todas as gerações');

  // só um controle de limpar dentro do campo (nada de "x" nativo duplicado)
  await expect(page.locator('.pokedex__search-field .pokedex__clear')).toHaveCount(1);

  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(page.locator('app-pokemon-card')).toHaveCount(151);
  await expect(page.locator('.pokedex__gen')).toHaveText('Geração I · #001–#151');
});

test('filtro local por número mostra 1 card, centralizado', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  await searchBox(page).fill('1');
  await expect(page.locator('app-pokemon-card')).toHaveCount(1);
  await expect(page.locator('.card__name')).toHaveText('Bulbasaur');

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
  // descrição em pt-BR (a PokéAPI só tem em inglês; tradução embutida no app)
  await expect(page.locator('app-pokemon-detail .detail__flavor')).toContainText(
    'Foi criado por um cientista',
  );
  await expect(page.locator('app-pokemon-detail')).toContainText('Geração');
  // altura/peso convertidos de dm/hg para m/kg (Mewtwo: 20 dm / 1220 hg)
  await expect(page.locator('app-pokemon-detail')).toContainText('2.0 m');
  await expect(page.locator('app-pokemon-detail')).toContainText('122.0 kg');
});

test('card mostra só a arte oficial (o GIF fica no detalhe)', async ({ page }) => {
  const gifRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('.gif')) {
      gifRequests.push(req.url());
    }
  });

  await page.goto('/');
  await waitForGrid(page);
  await firstCard(page).hover();
  await expect(page.locator('app-pokemon-card img').first()).toHaveAttribute(
    'src',
    /official-artwork\/1\.png$/,
  );
  expect(gifRequests).toHaveLength(0);
});

test('status em hexágono com total e GIF no detalhe (funciona sem mouse)', async ({ page }) => {
  await page.goto('/pokemon/charizard');
  await expect(page.locator('app-pokemon-detail .detail__name')).toHaveText('Charizard');

  // Charizard tem GIF da Gen V: o botão aparece e alterna arte <-> GIF
  const art = page.locator('.detail__art');
  const animate = page.getByRole('button', { name: 'Animar' });
  await expect(animate).toBeVisible();
  await animate.click();
  await expect(art).toHaveAttribute('src', /animated\/6\.gif$/);
  await page.getByRole('button', { name: 'Ver arte' }).click();
  await expect(art).toHaveAttribute('src', /official-artwork\/6\.png$/);

  // habilidades em pt-BR (a PokéAPI só tem em inglês)
  await expect(page.locator('.detail__abilities li')).toHaveText(['Chama', 'Energia Solar']);

  // 78 + 84 + 78 + 109 + 85 + 100 (no desktop o hexágono já aparece junto)
  await expect(page.locator('app-stat-hexagon .hex__total')).toContainText('534');
  await expect(page.locator('app-stat-hexagon .hex__value')).toHaveCount(6);

  // celular: painel de baixo; setas trocam entre Sobre e Status
  await page.setViewportSize({ width: 390, height: 844 });
  const sobre = page.getByRole('tab', { name: 'Sobre' });
  const sheetHeight = () =>
    page.evaluate(() =>
      Math.round(document.querySelector('.p-dialog')!.getBoundingClientRect().height),
    );
  const heightOnSobre = await sheetHeight();
  await sobre.focus();
  await sobre.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Status' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('app-stat-hexagon .hex__total')).toContainText('534');
  await expect(page.locator('.detail__flavor')).toHaveCount(0);
  // o painel tem altura fixa: trocar de aba não o faz crescer nem encolher
  await expect.poll(sheetHeight).toBe(heightOnSobre);
  await page.setViewportSize({ width: 1280, height: 720 });

  // #650 não tem GIF: o botão não é oferecido
  await page.goto('/pokemon/chespin');
  await expect(page.locator('app-pokemon-detail .detail__name')).toHaveText('Chespin');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: 'Animar' })).toHaveCount(0);
});

test('abas de geração: troca instantânea, ?gen no endereço e busca em todas', async ({ page }) => {
  const listRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/v2/pokemon?')) {
      listRequests.push(req.url());
    }
  });
  await page.goto('/');
  await waitForGrid(page);

  // Geração III: #252–#386 (135 Pokémon), sem nova requisição de lista
  await page.getByRole('tab', { name: /Geração III,/ }).click();
  await expect(page.locator('app-pokemon-card')).toHaveCount(135);
  await expect(page.locator('.card__name').first()).toHaveText('Treecko');
  await expect(page).toHaveURL(/[?&]gen=3/);
  expect(listRequests).toHaveLength(1);

  // teclado: seta para a direita vai para a Geração IV
  await page.getByRole('tab', { name: /Geração III,/ }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Geração IV,/ })).toBeFocused();
  await expect(page.locator('.card__name').first()).toHaveText('Turtwig');

  // a busca acha Pokémon de outra geração mesmo com a aba IV aberta
  await searchBox(page).fill('pikach');
  await expect(page.locator('.card__name')).toHaveText(['Pikachu']);
  await searchBox(page).fill('');

  // abrir e fechar um detalhe mantém a aba; F5 também
  await firstCard(page).click();
  await expect(page).toHaveURL(/\/pokemon\/turtwig\?gen=4/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/\?gen=4$/);
  await page.reload();
  await waitForGrid(page);
  await expect(page.locator('.pokedex__gen')).toHaveText('Geração IV · #387–#493');
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

test('carregamento só na tela da Pokédex: pokébola e depois a grade', async ({ page }) => {
  await page.goto('/');
  // o resto da página (carcaça, busca) já aparece; só a tela mostra a pokébola
  await expect(page.getByLabel('Buscar Pokémon')).toBeVisible();
  await expect(page.locator('.pokedex__results app-screen-intro')).toHaveCount(1);
  await expect(page.locator('app-screen-intro')).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator('app-pokemon-card')).toHaveCount(151);
});

test('fechar o detalhe mantém a rolagem (não volta ao topo da lista)', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);

  // espera a tela terminar de esticar (animação de altura no fim do carregamento)
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('.pokedex__results')!.getAnimations().length),
    )
    .toBe(0);

  // último Pokémon da Geração I, lá embaixo da grade
  const mew = page.locator('app-pokemon-card .card', { hasText: 'Mew' }).last();
  await mew.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(1000);

  await mew.click();
  await expect(page.locator('app-pokemon-detail .detail__name')).toHaveText('Mew');
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 50);
  await expect(mew).toBeInViewport();
});

test('detalhe nunca rola: encaixa até as descrições mais longas em telas baixas', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const overflow = () =>
    page.evaluate(() => {
      const c = document.querySelector('.pokemon-detail__content') as HTMLElement;
      return c.scrollHeight - c.clientHeight;
    });
  // notebook baixo, 800×600 e celular pequeno; #342 e #303 têm as maiores descrições
  for (const [w, h] of [
    [1366, 657],
    [800, 600],
    [360, 640],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const id of ['342', '303']) {
      await page.goto('/pokemon/' + id);
      await expect(page.locator('.detail__flavor')).toBeVisible();
      await expect.poll(overflow, { message: `${w}x${h} #${id}` }).toBeLessThanOrEqual(0);
      if (w < 760) {
        await page.getByRole('tab', { name: 'Status' }).click();
        await expect.poll(overflow, { message: `${w}x${h} #${id} status` }).toBeLessThanOrEqual(0);
      }
    }
  }
});
