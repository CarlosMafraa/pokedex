import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

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

test('diálogo de detalhe não tem violações (aba Sobre e Status)', async ({ page }) => {
  await page.goto('/pokemon/bulbasaur');
  await expect(page.locator('app-pokemon-detail .detail__name')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await scan(page)).violations).toEqual([]);

  await page.getByRole('tab', { name: 'Status' }).click();
  await expect(page.locator('app-stat-hexagon .hex__chart')).toBeVisible();
  // a tabela acessível espelha os 6 stats + total
  await expect(page.locator('app-stat-hexagon table tr')).toHaveCount(7);
  expect((await scan(page)).violations).toEqual([]);
});
