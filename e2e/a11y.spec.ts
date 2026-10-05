import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG).analyze();
}

async function waitForGrid(page: Page) {
  await expect(page.locator('app-pokemon-card .card').first()).toBeVisible();
  await expect(page.locator('app-screen-intro')).toHaveCount(0);
  await page.waitForTimeout(500);
}

const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('grade não tem violações de acessibilidade (claro e escuro)', async ({ page }) => {
  await page.goto('/');
  await waitForGrid(page);
  expect((await scan(page)).violations).toEqual([]);

  await page.getByRole('button', { name: /modo escuro/i }).click();
  // espera a transição de tema (0,2s no body) e a troca de stylesheet do PrimeNG
  // assentarem — senão o axe mede cores intermediárias e acusa falso-positivo.
  await expect.poll(() => bodyBg(page)).toBe('rgb(14, 14, 17)');
  await page.waitForTimeout(300);
  expect((await scan(page)).violations).toEqual([]);
});

test('diálogo de detalhe não tem violações (desktop e painel do celular)', async ({ page }) => {
  // desktop: cartão em duas colunas, tudo visível (sobre + hexágono)
  await page.goto('/pokemon/bulbasaur');
  await expect(page.locator('app-pokemon-detail .detail__name')).toBeVisible();
  await expect(page.locator('app-stat-hexagon .hex__chart')).toBeVisible();
  // a tabela acessível espelha os 6 stats + total
  await expect(page.locator('app-stat-hexagon table tr')).toHaveCount(7);
  await page.waitForTimeout(500);
  expect((await scan(page)).violations).toEqual([]);

  // celular: painel de baixo com o seletor Sobre | Status
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: 'Sobre' })).toHaveAttribute('aria-selected', 'true');
  await page.waitForTimeout(500);
  expect((await scan(page)).violations).toEqual([]);

  await page.getByRole('tab', { name: 'Status' }).click();
  await expect(page.locator('app-stat-hexagon .hex__chart')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await scan(page)).violations).toEqual([]);
});
