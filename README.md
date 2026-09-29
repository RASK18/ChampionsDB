# ChampionsDB

Base estática de datos de combate de **Pokémon Champions**, en español de España. JSON y JavaScript ESM, sin servidor ni base de datos. Incluye una web de tablas y filtros combinables preparada para `https://disboard.es/ChampionsDB/`. El código está publicado en [RASK18/ChampionsDB](https://github.com/RASK18/ChampionsDB). El despliegue de la web queda pendiente de activar GitHub Pages.

**La cobertura es parcial y se mide explícitamente.** La fuente principal es **champout**, con los textos `esp`. Otras fuentes específicas de Champions completan únicamente los 147 huecos autorizados. Se publican sus datos sin exigir un segundo proveedor, conservando evidencias y validación de integridad. Las ausencias y las reglas aún sin interpretar se enumeran en [el informe de pendientes](data/reports/pending.json). No se incluyen datos de uso, tiers, winrates ni recomendaciones competitivas.

La captura representa el commit de champout, no una certificación de la versión vigente del juego. OP.GG, el módulo Champions de Showdown y el anuncio oficial completan 146 de esos huecos. Sigue pendiente el marcador global de todas las interacciones y excepciones de combate; no equivale a un único dato. Véase [el alcance y sus fuentes](docs/suplementos.md).

## Uso

Requiere Node.js 24. Las dependencias de desarrollo son Ajv, Cheerio, el cargador de datos de Pokémon Showdown y Playwright para las pruebas de navegador. El navegador no necesita ninguna.

```sh
npm ci
npm test
npm run data:update
npm run data:validate
npm run data:rebuild
npm run site:dev
```

- `data:update`: descarga champout y los complementos autorizados, reutiliza capturas inmutables, normaliza, valida y publica una generación completa.
- `data:validate`: verifica todos los registros, referencias, evidencias, esquemas y huellas del conjunto publicado.
- `data:rebuild`: reconstruye sin red a partir del manifiesto y las capturas locales. Una ejecución sin cambios conserva los archivos y su informe de cambios.
- `site:build`: genera la web completa en `dist/`, con cobertura compacta y evidencias por entidad.
- `sprites:update`: vuelve a capturar los sprites usados por las 355 formas publicadas y guarda su origen y SHA-256 en `site/sprites/manifest.json`.
- `site:dev`: construye y sirve la web en `http://127.0.0.1:4173/ChampionsDB/`.
- `test:browser`: comprueba tablas, filtros, detalles, teclado y móvil con Playwright (instalar antes Chromium con `npx playwright install chromium`).

Los JSON de consulta están en [`data/`](data/). El [manifiesto](data/manifest.json), la [cobertura](data/reports/coverage.json) y la [procedencia por colección](data/provenance/) permiten auditar la publicación. Los sprites se sirven desde el propio sitio, sin solicitudes externas del navegador. `complete: false` es una limitación real, no una etiqueta decorativa.

## Consultas sin servidor

```js
import {loadDatabase} from './lib/queries.mjs';

const db = await loadDatabase('/ChampionsDB/data/');
const lluvia = db.producersOfEffect('rain');
// { records: [{ pokemon, paths }], coverage }

db.pokemonForMove('move-240');       // Danza Lluvia
db.pokemonForAbility('ability-002'); // Llovizna
db.formsOfSpecies('species-003');   // Venusaur y sus formas
db.relatedToEffect('paralysis');
db.conditions();
db.berries();
db.megaStones();
db.regulation('m-c'); // Reglamento oficial, periodo y restricciones documentadas; no valida un equipo completo.
```

Los índices se generan una vez en memoria. Lluvia distingue creación directa y rutas condicionales mediante copia de habilidades; no presenta Nado Rápido como productor. La elegibilidad de una habilidad copiada **no se evalúa como en un simulador**: la ruta devuelve los requisitos pendientes de cumplir.

## Actualización en GitHub

[El workflow](.github/workflows/update-data.yml) tiene ejecución manual y diaria a las **04:17 UTC**. Comprueba las pruebas y la publicación, verifica la reconstrucción sin red y hace commit únicamente de `data/` y `sources/snapshot.json` cuando cambian. Las capturas e informes se guardan como artefactos durante 30 días. La frecuencia de captura no garantiza que un proveedor ya haya incorporado un cambio del juego.

El remoto `origin` apunta a [RASK18/ChampionsDB](https://github.com/RASK18/ChampionsDB), con `main` como rama principal. Los workflows están publicados; la actualización diaria solicita escritura al token de Actions. Una protección de rama que prohíba esos commits debe configurarse por el propietario. No se ha modificado el dominio ni desplegado una web.

## Documentación

- [Modelo, semántica y relaciones](docs/modelo.md).
- [Web: filtros, arquitectura, pruebas y activación de GitHub Pages](docs/web.md).
- [Fuentes, normalización y límites de cobertura](docs/aprovisionamiento.md).
- [Operación, reconstrucción y revisión de nuevas mecánicas](docs/operacion.md).
- [Complementos de los 147 huecos y límites](docs/suplementos.md).
- [Registro de proveedores y dependencias conocidas](sources/providers.json).
- [Reglas y equivalencias revisadas, vinculadas a sus evidencias](rules/champout-reviewed.json).

El código conserva la licencia del repositorio. Los nombres, textos e imágenes de Pokémon y las fuentes externas mantienen sus respectivos derechos; no se les atribuye automáticamente la licencia del código.
