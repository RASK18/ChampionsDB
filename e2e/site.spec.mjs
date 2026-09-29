import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isTeamEntryForm } from "../site/form-roles.mjs";
const count = (collection) => JSON.parse(readFileSync(new URL(`../data/${collection}.json`, import.meta.url))).length.toLocaleString("es");
const entryCount = JSON.parse(readFileSync(new URL('../data/pokemon.json', import.meta.url))).filter(isTeamEntryForm).length.toLocaleString('es');
test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#confirmed-count")).toHaveText(entryCount);
});

test("complementos visibles: efectividades, naturalezas y fuentes delimitadas", async ({ page }) => {
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Tipos", exact: true }).click();
  await page.getByRole("button", { name: "Ver matriz", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(18);
  await expect(page.locator("tbody")).not.toContainText("Pendiente");
  await expect(page.locator("tbody")).not.toContainText("Sin dato");
  await expect(page.locator("tbody td:not(:first-child)")).toHaveCount(324);
  await nav.getByRole("button", { name: "Naturalezas", exact: true }).click();
  await page.getByRole("searchbox").fill("Fuerte");
  await expect(page.locator("#confirmed-count")).toHaveText("1");
  await expect(page.locator("tbody")).not.toContainText("Pendiente");
  await page.getByRole("button", { name: "Cobertura y fuentes", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("147 huecos autorizados");
  await expect(page.getByRole("dialog")).toContainText("sin sustituir datos de champout");
});
test("carga diferida, paginación, búsqueda, memoria de sección y recarga", async ({
  page,
}) => {
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((r) => r.name.includes("/learnsets.json")),
    ),
  ).toBe(false);
  expect(await page.evaluate(() => performance.getEntriesByType("resource")
    .some((r) => r.name.includes("/moves.json")))).toBe(false);
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.locator("#pagination")).toContainText("51–100");
  await page.getByRole("searchbox").fill("Venusaur");
  await expect(page.locator("#confirmed-count")).toHaveText("1");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Movimientos", exact: true })
    .click();
  await expect(page.locator("#title")).toHaveText("Movimientos");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Pokémon", exact: true })
    .click();
  await expect(page.getByRole("searchbox")).toHaveValue("Venusaur");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#search")).toHaveValue("Venusaur");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
test("un usuario añade y excluye un tipo desde el explorador", async ({
  page,
}) => {
  await page.getByLabel("Añadir criterio").selectOption("type");
  const typeCard = page.locator(".explore-card");
  await typeCard.getByLabel("Tipo", { exact: true }).selectOption("water");
  await expect(page.locator("#filter-summary")).toContainText("Agua");
  const count = Number(
    (await page.locator("#confirmed-count").innerText()).replaceAll(".", ""),
  );
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(1000);
  await typeCard.getByLabel("Condición").selectOption("exclude");
  await expect(page.locator("#filter-summary")).toContainText("Ninguna");
  await page.getByRole("button", { name: "Todos los campos", exact: true }).click();
  await expect(page.getByLabel("Campo", { exact: true })).toHaveValue(
    "typeIds",
  );
  await expect(page.getByLabel("Operador", { exact: true })).toHaveValue(
    "some",
  );
});
test("las cinco búsquedas guiadas crean condiciones editables y explican coincidencias", async ({ page }) => {
  await page.getByRole("searchbox").fill("Venusaur");
  for (const title of [
    "Intimidación y cambio", "Cobertura amplia", "Atacante para Espacio Raro",
    "Bromista y control", "Experto y multigolpe",
  ]) {
    await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
    await expect(page.locator("#search")).toHaveValue("");
    await expect(page.locator("#confirmed-count")).not.toHaveText("0");
    await expect(page.locator("#possible-count")).toHaveText("0");
    await expect(page.locator("#possible-tab")).toBeHidden();
    await expect(page.locator(".explore-card").first()).toBeVisible();
    if (title === "Intimidación y cambio") {
      const countBeforeReload = await page.locator("#confirmed-count").innerText();
      await page.reload();
      await expect(page.locator("#confirmed-count")).toHaveText(countBeforeReload);
      await expect(page.locator(".explore-card")).toHaveCount(2);
    }
  }
  const movement = page.locator(".explore-card").filter({ hasText: "Debe aprender un movimiento que" });
  await expect(movement).toContainText("mismo movimiento");
  await movement.getByLabel("Potencia", { exact: true }).fill("20");
  await expect(page.locator("#filter-summary")).toContainText("20");
  await movement.getByLabel("Potencia", { exact: true }).fill("60");
  await expect(page.locator("#confirmed-count")).not.toHaveText("0");
  await page.locator("tbody .why summary").first().click();
  await expect(page.locator("tbody .why li").first()).toContainText(/Experto|Aprende|Velocidad/);
  await movement.getByLabel("Propiedad del movimiento").first().selectOption("id");
  await page.getByRole("button", { name: "Todos los campos", exact: true }).click();
  await expect(page.locator(".relation .clause").getByLabel("Movimiento", { exact: true })).toBeVisible();
  for (const title of ["Atacante especial rápido", "Prioridad ofensiva"]) {
    await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
    await expect(page.locator("#confirmed-count")).not.toHaveText("0");
  }
});
test("el rol editado muestra sus criterios actuales y oculta dudas inexistentes en móvil", async ({ page }) => {
  await page.getByRole("button", { name: /^Atacante para Espacio Raro/ }).click();
  await page.getByRole("button", { name: "Todos los campos", exact: true }).click();
  await page.getByLabel("Valor", { exact: true }).first().fill("100");
  await page.getByRole("button", { name: "Explorar", exact: true }).click();
  await expect(page.locator(".explore-card .card-hint")).toContainText("Velocidad ≤ 100");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: /^Experto y multigolpe/ }).click();
  await expect(page.locator("#possible-count")).toHaveText("0");
  await expect(page.locator("#possible-tab")).toBeHidden();
});
test("Arbok queda descartado y no se ofrece una pestaña sin verificar", async ({ page }) => {
  await page.getByRole("button", { name: /^Intimidación y cambio/ }).click();
  await expect(page.locator("#possible-count")).toHaveText("0");
  await expect(page.locator("#possible-tab")).toBeHidden();
  await expect.poll(() => page.locator('tbody .pokemon-sprite').first()
    .evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: 'test-results/preset.png', fullPage: true });
  await page.locator("#search").fill("Arbok");
  await expect(page.locator("#confirmed-count")).toHaveText("0");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
test("las formas de combate se consultan aparte y enlazan su forma de entrada", async ({ page }) => {
  await expect(page.locator('#result-note')).toContainText('266 formas de entrada');
  const include = page.getByRole('checkbox', {name:/Incluir Mega y otras formas/});
  await include.check();
  await expect(page.locator('#result-note')).toContainText('355 registros');
  await page.locator('#search').fill('Morpeko');
  await page.getByRole('button', {name:'Morpeko (Forma Voraz)', exact:true}).click();
  await expect(page.locator('#pokemon-detail-view')).toBeVisible();
  await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.locator('#pokemon-detail-content')).toContainText('forma de entrada');
  await page.getByRole('button', {name:/Ver forma de entrada: Morpeko/}).click();
  await expect(page.locator('#pokemon-detail-title')).toHaveText('Morpeko (Forma Saciada)');
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#search')).toHaveValue('Morpeko');
  await expect(include).toBeChecked();
});
test('ficha de combate: efectividad, movimientos y vuelta con filtros y página', async ({ page }) => {
  await page.locator('#search').fill('Blastoise');
  await expect(page.locator('#confirmed-count')).toHaveText('1');
  await page.locator('tbody').getByRole('button', {name:'Blastoise', exact:true}).click();
  await expect(page).toHaveURL(/#pokemon\/pokemon-/);
  await expect(page.locator('#pokemon-detail-view')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.pokemon-detail-stats')).toContainText('TOTAL 530');
  await expect(page.locator('.matchup-group.weak')).toContainText('Eléctrico');
  await expect(page.locator('.matchup-group.weak')).toContainText('Planta');
  await expect(page.locator('.pokemon-abilities')).toContainText('Torrente');
  await expect(page.locator('.detail-move-count')).toContainText('movimientos confirmados');
  await page.getByRole('searchbox', {name:'Buscar movimiento'}).fill('Hidrobomba');
  await expect(page.locator('.detail-move-scroll tbody tr')).toHaveCount(1);
  await expect(page.locator('.detail-move-scroll')).toContainText('Hidrobomba');
  await page.getByRole('searchbox', {name:'Buscar movimiento'}).fill('');
  await page.screenshot({ path: 'test-results/blastoise-detail.png', fullPage: true });
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#search')).toHaveValue('Blastoise');
  await expect(page.locator('#workspace tbody tr')).toHaveCount(1);
  await page.goForward();
  await expect(page.locator('#pokemon-detail-title')).toHaveText('Blastoise');
  await page.reload();
  await expect(page.locator('#pokemon-detail-title')).toHaveText('Blastoise');
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#search')).toHaveValue('Blastoise');
  await page.goForward();
  await page.getByRole('navigation').getByRole('button', {name:'Movimientos', exact:true}).click();
  await page.goBack();
  await expect(page.locator('#pokemon-detail-title')).toHaveText('Blastoise');
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#search')).toHaveValue('Blastoise');
});
test('volver de la ficha conserva condiciones y paginación', async ({ page }) => {
  await page.getByRole('button', {name:/Intimidación y cambio/}).click();
  const count = await page.locator('#confirmed-count').innerText();
  await page.locator('#workspace tbody .name-button').first().click();
  await expect(page.locator('#pokemon-detail-view')).toBeVisible();
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#confirmed-count')).toHaveText(count);
  await expect(page.locator('.explore-card')).toHaveCount(2);
  await page.getByRole('button', {name:'Restablecer'}).click();
  await page.getByRole('button', {name:'Siguiente', exact:true}).click();
  await expect(page.locator('#pagination')).toContainText('51–100');
  await page.locator('#workspace tbody .name-button').first().click();
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#pagination')).toContainText('51–100');
});
test('ficha de movimiento muestra Pokémon con imágenes y conserva el filtro al volver', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', {name:'Movimientos', exact:true}).click();
  const category = page.locator('.quick-field').filter({hasText:'Categoría'});
  await category.locator('summary').click();
  await category.getByLabel('Físico', {exact:true}).check();
  await expect(page.locator('#filter-summary')).toContainText('Físico');
  await page.locator('#search').fill('Fitoimpulso');
  await expect(page.locator('#confirmed-count')).toHaveText('1');
  await page.locator('#workspace tbody .name-button').first().click();
  await expect(page).toHaveURL(/#moves\/move-803/);
  await expect(page.locator('#move-detail-view')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('#move-detail-title')).toHaveText('Fitoimpulso');
  await expect(page.locator('.move-summary')).toContainText('Planta');
  await expect(page.locator('.move-summary')).toContainText('Potencia55');
  await expect(page.locator('.move-users-count')).toContainText('Pokémon confirmados');
  await expect.poll(() => page.locator('.move-user-name img').first().evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: 'test-results/fitoimpulso-detail.png', fullPage: true });
  await page.getByRole('searchbox', {name:'Buscar Pokémon que aprende este movimiento'}).fill('Rillaboom');
  await expect(page.locator('.move-users-scroll tbody tr')).toHaveCount(1);
  await page.locator('.move-users-scroll').getByRole('button', {name:'Rillaboom'}).click();
  await expect(page.locator('#pokemon-detail-title')).toHaveText('Rillaboom');
  await page.getByRole('button', {name:'Volver al movimiento'}).click();
  await expect(page.locator('#move-detail-title')).toHaveText('Fitoimpulso');
  await expect(page.getByRole('searchbox', {name:'Buscar Pokémon que aprende este movimiento'})).toHaveValue('Rillaboom');
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#title')).toHaveText('Movimientos');
  await expect(page.locator('#search')).toHaveValue('Fitoimpulso');
  await expect(page.locator('#filter-summary')).toContainText('Físico');
  await expect(page.locator('#workspace tbody tr')).toHaveCount(1);
});
test('ficha de movimiento conserva paginación y enlace directo', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', {name:'Movimientos', exact:true}).click();
  await page.getByRole('button', {name:'Siguiente', exact:true}).click();
  await expect(page.locator('#pagination')).toContainText('51–100');
  await page.locator('#workspace tbody .name-button').first().click();
  const title = await page.locator('#move-detail-title').innerText();
  await page.reload();
  await expect(page.locator('#move-detail-title')).toHaveText(title);
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#pagination')).toContainText('51–100');
  await expect(page.locator('#title')).toHaveText('Movimientos');
});
test('un movimiento abierto desde un Pokémon vuelve a su filtro de movimientos', async ({ page }) => {
  await page.locator('#search').fill('Blastoise');
  await expect(page.locator('#confirmed-count')).toHaveText('1');
  await page.locator('#workspace tbody .name-button').first().click();
  await page.getByRole('searchbox', {name:'Buscar movimiento'}).fill('Hidrobomba');
  await expect(page.locator('.detail-move-scroll tbody tr')).toHaveCount(1);
  await page.locator('.detail-move-scroll').getByRole('button', {name:'Hidrobomba'}).click();
  await expect(page.locator('#move-detail-title')).toHaveText('Hidrobomba');
  await page.getByRole('button', {name:'Volver al Pokémon'}).click();
  await expect(page.locator('#pokemon-detail-title')).toHaveText('Blastoise');
  await expect(page.getByRole('searchbox', {name:'Buscar movimiento'})).toHaveValue('Hidrobomba');
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator('#search')).toHaveValue('Blastoise');
});
test('ficha de movimiento en móvil sin desbordamiento de la página', async ({ page }) => {
  await page.setViewportSize({width: 320, height: 720});
  await page.getByRole('navigation').getByRole('button', {name:'Movimientos', exact:true}).click();
  await page.locator('#search').fill('Fitoimpulso');
  await expect(page.locator('#confirmed-count')).toHaveText('1');
  await page.locator('#workspace tbody .name-button').first().click();
  await expect(page.locator('#move-detail-view')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.locator('.move-users-scroll')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-move-detail.png', fullPage: true });
});
test("relación anidada y resultados desconocidos; columnas y ordenación", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Todos los campos", exact: true }).click();
  await page.getByRole("button", { name: "+ Relación", exact: true }).click();
  await page.getByLabel("Relación", { exact: true }).selectOption("moves");
  await page.getByLabel("Cuantificador").selectOption("none");
  await page
    .locator(".relation")
    .getByRole("button", { name: "+ Condición", exact: true })
    .click();
  await page.getByLabel("Valor", { exact: true }).fill("lluvia");
  await expect(page.locator("#confirmed-count")).not.toHaveText("0");
  await expect(page.locator("#possible-count")).toHaveText("0");
  await expect(page.locator("#possible-tab")).toBeHidden();
  await page.getByRole("button", { name: "Columnas", exact: true }).click();
  await page
    .locator("#columns-panel")
    .getByLabel("Peso (kg)", { exact: true })
    .check();
  await expect(
    page.getByRole("columnheader", { name: "Peso (kg)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ordenar", exact: true }).click();
  await page
    .getByRole("button", { name: "Añadir criterio", exact: true })
    .click();
  await expect(page.getByLabel("Criterio 2", { exact: true })).toBeVisible();
});
test("Lluvia, evidencias por entidad y matriz de tipos", async ({ page }) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Efectos", exact: true })
    .click();
  await page.getByRole("searchbox").fill("Lluvia");
  await page
    .locator("tbody")
    .getByRole("button", { name: "Lluvia", exact: true })
    .click();
  await expect(
    page.getByText("Pokémon capaces de provocar este efecto si se cumplen los requisitos", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Incluir rutas indirectas condicionadas").check();
  await page
    .getByRole("button", { name: "Consultar evidencias", exact: true })
    .click();
  await expect(
    page.getByText("Evidencias y campos sin dato", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((r) => r.name.includes("/provenance/")),
    ),
  ).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tipos", exact: true })
    .click();
  await page.getByRole("button", { name: "Ver matriz", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(18);
  await expect(page.locator("thead th")).toHaveCount(19);
});
test("móvil 320px, teclado, tema y tabla desplazable sin desbordar la página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload();
  await expect(page.locator("#filters")).not.toBeVisible();
  await page.getByRole("button", { name: /Filtros/ }).click();
  await expect(page.locator("#filters")).toBeVisible();
  await page.getByRole("button", { name: /Filtros/ }).click();
  await expect(page.locator("table")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const old = await page.locator("html").getAttribute("data-theme");
  await page.getByRole("button", { name: "Cambiar tema" }).click();
  expect(await page.locator("html").getAttribute("data-theme")).not.toBe(old);
  await page.locator("tbody button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('#pokemon-detail-view')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'test-results/mobile-detail.png', fullPage: true });
  await page.getByRole('button', {name:'Volver a resultados'}).click();
  await expect(page.locator("tbody button").first()).toBeFocused();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test('la vista intermedia conserva búsqueda, filtros y tabla sin desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.reload();
  await expect(page.locator('#filters')).toBeVisible();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.locator('tbody .pokemon-sprite').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.screenshot({ path: 'test-results/tablet.png', fullPage: true });
});
test("error de carga recuperable", async ({ page }) => {
  await page.route("**/data/items.json*", (route) =>
    route.fulfill({ status: 503, body: "Error temporal" }),
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Objetos", exact: true })
    .click();
  await expect(page.locator("#notice")).toContainText("No se pudo cargar");
  await page.unroute("**/data/items.json*");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.locator("#confirmed-count")).toHaveText(count("items"));
});
test("aprendizajes paginados con nombres resueltos y filtros sobre datos anidados", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Aprendizajes", exact: true }).click();
  await expect(page.locator("#confirmed-count")).toHaveText(count("learnsets"));
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.locator("tbody tr").first()).not.toContainText("move-");
  await page.getByLabel("Filas por página").selectOption("100");
  await expect(page.locator("tbody tr")).toHaveCount(100);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Reglas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Interacciones", exact: true })
    .click();
  await page.getByRole("button", { name: "Todos los campos", exact: true }).click();
  await page.getByRole("button", { name: "+ Condición", exact: true }).click();
  await page.getByLabel("Campo", { exact: true }).selectOption("rule.relation");
  await page
    .getByLabel("Valores (selección múltiple)")
    .selectOption({ label: "Provoca" });
  await expect(page.locator("#confirmed-count")).not.toHaveText("0");
  await expect(page.locator("tbody tr").first()).toContainText("Provoca");
});
test("todas las secciones, detalles y captura de escritorio sin errores de consola", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const title of [
    "Movimientos",
    "Habilidades",
    "Objetos",
    "Efectos",
    "Tipos",
    "Naturalezas",
    "Reglas",
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: title, exact: true })
      .click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Interacciones", exact: true })
    .click();
  await expect(page.locator("#title")).toHaveText("Interacciones");
  await page.locator("tbody button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Pokémon", exact: true })
    .click();
  await expect(page.locator("#confirmed-count")).toHaveText(entryCount);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
