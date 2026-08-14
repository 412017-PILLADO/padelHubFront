import { test, expect, Page, request as pwRequest } from '@playwright/test';
import { API, elegirDiaYSlot } from './helpers';

/**
 * Valida las 4 plantillas de landing (A poster, B hero centrado, C compacta app, E diurna): que cada
 * tenant renderice SU layout y que el flujo de reserva (compartido por las 4) llegue al éxito en
 * todas. Corre contra tenants dedicados (acepadel/costapadel/urbanpadel/solpadel) resueltos por
 * subdominio `<slug>.localhost`; si no existen (base recién reseteada) se provisionan acá por la API
 * de plataforma con la key de dev.
 */
const PLANTILLAS = [
  { slug: 'acepadel', nombre: 'Ace Pádel', tpl: 'A', shell: '.poster' },
  { slug: 'costapadel', nombre: 'Costa Pádel', tpl: 'B', shell: '.tpl-b' },
  { slug: 'urbanpadel', nombre: 'Urban Pádel', tpl: 'C', shell: '.tpl-c' },
  { slug: 'solpadel', nombre: 'Sol Pádel', tpl: 'E', shell: '.tpl-e' },
];

test.beforeAll(async () => {
  const ctx = await pwRequest.newContext();
  for (const { slug, nombre, tpl } of PLANTILLAS) {
    const probe = await ctx.get(`${API}/public/config`, { headers: { 'X-Tenant': slug } });
    if (probe.ok()) continue;
    const alta = await ctx.post(`${API}/platform/tenants`, {
      headers: { 'X-Platform-Key': 'dev-platform-key', 'Content-Type': 'application/json' },
      data: {
        slug, name: nombre, plantilla: tpl,
        ownerEmail: `owner@${slug}.com`, ownerPassword: 'padel123',
        hosts: [`${slug}.localhost`],
      },
    });
    if (!alta.ok()) {
      throw new Error(`No se pudo provisionar ${slug}: ${alta.status()} ${await alta.text()}`);
    }
  }
  await ctx.dispose();
});

/** Completa los 5 pasos de reserva (el markup es idéntico en las 4 plantillas). */
async function reservar(page: Page, phoneSuffix: string): Promise<void> {
  // 01 · Duración
  await expect(page.locator('.dur-chips .chip').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('.dur-chips .chip').first().click();
  // 02/03 · Día y horario — primer día con slot libre (de noche "Hoy" puede no tener)
  await elegirDiaYSlot(page);
  // 04 · Cancha — cualquiera
  await page.locator('.ccard.any').click();
  // 05 · Datos (teléfono único por corrida)
  await page.locator('#fName').fill('Test Plantilla');
  const phone = page.locator('#fPhone');
  if (await phone.isVisible()) {
    await phone.fill(`35155${phoneSuffix}`);
  }
  await page.locator('.confirm').click();
  // Éxito
  await expect(page.locator('.success.open')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.recap')).toBeVisible();
}

for (const { slug, tpl, shell } of PLANTILLAS) {
  test(`plantilla ${tpl} (${slug}): renderiza su layout y reserva hasta el éxito`, async ({ page }) => {
    await page.goto(`http://${slug}.localhost:4400/`);

    // El host de la landing marca la plantilla elegida y se ve la shell correspondiente.
    await expect(page.locator(`[data-tpl="${tpl}"]`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(shell)).toBeVisible();

    // B es la única plantilla oscura (spec §6): el fondo del shell tiene que ser oscuro de verdad,
    // no el papel claro de plataforma. Se mide la luminancia del color computado en vez de comparar
    // contra un hex, porque `--paper` se tiñe con el color del club y cambia por tenant.
    //
    // El color NO se parsea del string: `--paper` es un `color-mix(in srgb, …)` y Chromium lo
    // serializa como `color(srgb 0.043 0.066 0.181)` —floats 0..1, no `rgb()` de enteros—, así que
    // sacarle los dígitos a mano lee "0437647" como si fuera un canal. Se le pasa el color computado
    // al canvas y se deja que el propio navegador lo baje a bytes sRGB, sea cual sea la sintaxis.
    // La base blanca no es decorativa: un fondo transparente (B sin capa oscura) o un color que el
    // canvas no supiera parsear quedarían en negro sobre canvas vacío y PASARÍAN el test por
    // accidente; compuestos sobre blanco dan ~1.0 y lo hacen fallar, que es lo correcto.
    if (tpl === 'B') {
      const luminancia = await page.locator(shell).evaluate((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      });
      expect(luminancia).toBeLessThan(0.2);
    }

    // E es la única con el panel montado A CABALLO del borde de abajo del campo de color (spec §6):
    // esa es su firma, y hoy no la protege nadie. El contrato `--flow-*` mira que los tokens EXISTAN,
    // no dónde caen: un `--e-solape: 0` dejaría toda la suite en verde y habría borrado la plantilla.
    // Se mide la geometría real —no un token— porque lo que la firma afirma es que el borde del campo
    // cae ADENTRO de la caja del vidrio, y eso sólo lo sabe el layout.
    if (tpl === 'E') {
      const solape = await page.evaluate(() => {
        const campo = document.querySelector('.e-campo')!.getBoundingClientRect();
        const vidrio = document.querySelector('.booking-flow')!.getBoundingClientRect();
        return Math.round(campo.bottom - vidrio.top);
      });
      // 40 px es el PISO del `clamp(40px, 6vw, 68px)` de la cáscara, así que la aserción vale en
      // cualquier ancho de viewport; por debajo, el panel dejó de estar montado sobre el color.
      expect(solape).toBeGreaterThanOrEqual(40);
    }

    await reservar(page, `${tpl}${String(Date.now()).slice(-4)}`);
  });
}
