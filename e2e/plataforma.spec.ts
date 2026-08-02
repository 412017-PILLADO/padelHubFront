import { test, expect, Page } from '@playwright/test';
import { loginAsOwner, gotoAgenda } from './helpers';

/**
 * Panel de plataforma (super-admin) por la UI: login oculto en /plataforma, alta de un club con
 * plantilla, edición y baja con confirmación. Y el owner cambiando su plantilla desde su config.
 * Corre contra el backend real (dev :8095) que levanta el front en :4400.
 */
const ADMIN = { email: 'admin@padelhub.com', password: 'superadmin123' };

/** Login del super-admin por el formulario oculto; deja en /plataforma/tenants. */
async function loginPlataforma(page: Page): Promise<void> {
  await page.goto('/plataforma');
  const entrar = page.getByRole('button', { name: 'Entrar' });
  await expect(async () => {
    await page.locator('input[name="email"]').fill(ADMIN.email);
    await page.locator('input[name="password"]').fill(ADMIN.password);
    await expect(entrar).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await entrar.click();
  await expect(page).toHaveURL(/\/plataforma\/tenants$/, { timeout: 15_000 });
}

test('plataforma: alta con plantilla, edición y baja de un club', async ({ page }) => {
  await loginPlataforma(page);

  const slug = `e2eplat${Date.now().toString().slice(-6)}`;
  const nombre = `E2E ${slug}`;

  // ── Alta ──
  await page.getByRole('button', { name: '+ Nuevo club' }).click();
  const form = page.locator('.card.form');
  await form.getByPlaceholder('riopadel', { exact: true }).fill(slug);
  await form.getByPlaceholder('Rio Padel Club').fill(nombre);
  await form.getByPlaceholder('owner@club.com').fill(`owner@${slug}.com`);
  await form.getByPlaceholder('mínimo 6').fill('padel123');
  await form.locator('select').selectOption('B'); // plantilla B
  await page.getByRole('button', { name: 'Crear club' }).click();

  // Aparece en la tabla con su plantilla.
  const row = page.locator('.tr', { hasText: nombre });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText('plantilla B');

  // ── Edición: plantilla B → C ──
  await row.getByRole('button', { name: 'Editar' }).click();
  const editRow = page.locator('.tr.edit');
  await editRow.locator('select').last().selectOption('C'); // el select de plantilla
  await editRow.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.tr', { hasText: nombre })).toContainText('plantilla C', { timeout: 15_000 });

  // ── Baja con confirmación ──
  const row2 = page.locator('.tr', { hasText: nombre });
  await row2.getByRole('button', { name: 'Borrar' }).click();
  await row2.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('.tr', { hasText: nombre })).toHaveCount(0, { timeout: 15_000 });
});

test('owner: cambia la plantilla de su landing desde la config', async ({ page }) => {
  await loginAsOwner(page);
  await gotoAgenda(page);

  const sel = page.locator('.plantilla-sel');
  await expect(sel).toBeVisible({ timeout: 15_000 });
  // La marca ya no tiene botón propio: la persiste el Guardar único de la savebar (como el resto).
  const guardar = page.locator('.save-btn');
  try {
    await sel.selectOption('B');
    await expect(page.locator('.savebar .sv')).toHaveText('Cambios sin guardar');
    await guardar.click();
    await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 15_000 });
    // Confirma persistencia: al recargar la config, el select vuelve en B.
    await page.reload();
    await expect(page.locator('.plantilla-sel')).toHaveValue('B', { timeout: 15_000 });
  } finally {
    // Dejar demo en A para no ensuciar otros specs / la landing por defecto.
    await page.locator('.plantilla-sel').selectOption('A');
    await page.locator('.save-btn').click();
    await expect(page.locator('.savebar .sv')).toHaveText('Todo guardado', { timeout: 15_000 });
  }
});
