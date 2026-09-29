import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const count = (collection) => JSON.parse(readFileSync(new URL(`../data/${collection}.json`, import.meta.url))).length.toLocaleString("es");
test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#confirmed-count")).toHaveText(count("pokemon"));
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
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.locator("#pagination")).toContainText("51–100");
  await page.getByRole("searchbox").fill("Venusaur");
  await expect(page.locator("#confirmed-count")).toHaveText("2");
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
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(50);
});
test("filtro rápido inclusivo y exclusivo refleja el mismo grupo avanzado", async ({
  page,
}) => {
  const types = page
    .locator(".quick-field")
    .filter({ has: page.getByText("Tipos", { exact: true }) });
  await types.locator("summary").click();
  await types.getByLabel("Agua", { exact: true }).check();
  await expect(page.locator("#filter-summary")).toContainText("Agua");
  const count = Number(
    (await page.locator("#confirmed-count").innerText()).replaceAll(".", ""),
  );
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(1000);
  await types.getByLabel("Operación de Tipos").selectOption("none");
  await expect(page.locator("#filter-summary")).toContainText(
    "No contiene ninguno",
  );
  await page.getByRole("button", { name: "Avanzados", exact: true }).click();
  await expect(page.getByLabel("Campo", { exact: true })).toHaveValue(
    "typeIds",
  );
  await expect(page.getByLabel("Operador", { exact: true })).toHaveValue(
    "none",
  );
});
test("relación anidada y resultados desconocidos; columnas y ordenación", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Avanzados", exact: true }).click();
  await page.getByRole("button", { name: "+ Relación", exact: true }).click();
  await page.getByLabel("Relación", { exact: true }).selectOption("moves");
  await page.getByLabel("Cuantificador").selectOption("none");
  await page
    .locator(".relation")
    .getByRole("button", { name: "+ Condición", exact: true })
    .click();
  await page.getByLabel("Valor", { exact: true }).fill("lluvia");
  await expect(page.locator("#confirmed-count")).toHaveText("0");
  await expect(page.locator("#possible-count")).not.toHaveText("0");
  await page.locator("#possible-tab").click();
  await expect(page.locator("tbody .reason").first()).toContainText(
    "cobertura",
  );
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
    page.getByText("Pokémon que provocan este efecto", { exact: true }),
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
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("tbody button").first()).toBeFocused();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
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
  await page.getByRole("button", { name: "Avanzados", exact: true }).click();
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
  await expect(page.locator("#confirmed-count")).toHaveText(count("pokemon"));
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
