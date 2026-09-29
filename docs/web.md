# Web estática de ChampionsDB

## Desarrollo y entrega

Requiere Node.js 24. `npm ci` instala exclusivamente herramientas de preparación y pruebas. El navegador ejecuta HTML, CSS y módulos JavaScript sin framework.

```sh
npm run site:build
npm run site:preview
# http://127.0.0.1:4173/ChampionsDB/
npm test
npx playwright install chromium
npm run test:browser
npm run site:check
```

`site:dev` construye y sirve la web. No incluye vigilancia de archivos: después de editar, vuelve a ejecutar `site:build` y recarga. `dist/` es la publicación completa, ignorada por Git. El servidor de desarrollo solo sirve archivos locales; no forma parte del despliegue.

La construcción comprueba las huellas de los JSON de combate, genera el catálogo de campos y escribe una generación temporal antes de sustituir `dist`. No modifica `data/`, las reglas revisadas ni las capturas. Las entradas iguales producen los mismos archivos. Los directorios temporales `.site-stage` y `.site-previous` pertenecen únicamente a este empaquetador.

## Consulta y presentación

Los ocho accesos principales incluyen vistas adicionales de especies, aprendizajes, interacciones y reglamentos. El diseño parte del tema oscuro y permite cambiar al claro durante la visita. La búsqueda está en la cabecera; los controles de columnas y ordenación están en el panel de filtros. Las tablas usan 50 filas por página (25/50/100), columna de identificación y cabecera fijas. El selector de columnas ofrece todos los campos, incluidos los parámetros y requisitos anidados. La tabla de tipos permite alternar a la matriz atacante → defensor. El detalle incluye campos, relaciones y evidencias a petición.

La búsqueda y el árbol de filtros de Pokémon se conservan en la entrada actual del historial del navegador al recargar o regresar a la página. Las demás preferencias se conservan en memoria por sección y se pierden al recargar. No se escriben preferencias en localStorage, sessionStorage, cookies ni URL; la búsqueda conservada no es un enlace compartible. El cambio manual de tema dura la visita. Los enlaces a una tabla relacionada reemplazan su consulta por una selección explícita, que admite nuevas condiciones y puede eliminarse desde el editor avanzado.

### Imágenes de Pokémon

La web guarda un PNG por cada una de las 355 formas publicadas en `site/sprites/`. Se seleccionaron 344 sprites del [directorio gen5 de Pokémon Showdown](https://play.pokemonshowdown.com/sprites/gen5/) y once Mega Evoluciones ausentes de ese directorio del [repositorio de sprites de PokéAPI](https://github.com/PokeAPI/sprites). `site/sprites/manifest.json` registra la URL y el SHA-256 de cada archivo. `site:build` falla si falta una forma, sobra una entrada o cambia un archivo sin actualizar el manifiesto. El navegador carga las imágenes desde ChampionsDB y no contacta a esos proveedores.

`npm run sprites:update` permite volver a capturarlas y exige encontrar el sprite de cada forma. La selección de formas se mantiene en `scripts/lib/sprite-map.mjs`; una nueva forma necesita revisión explícita. Los derechos de las imágenes corresponden a The Pokémon Company y, en ciertos sprites derivados, a sus artistas; la licencia del código de los repositorios de origen no convierte estas imágenes en libres. Véanse las [condiciones publicadas por PokéAPI](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt) y la [nota de Smogon sobre sus sprites](https://github.com/smogon/sprites#license).

### Árbol de consulta

`site/engine.mjs` expone `createGraph`, `evaluate`, `queryRows`, `sortRows`, `fieldValue` y `undecided`. Son funciones compartibles con las pruebas de Node. Las condiciones utilizan rutas del catálogo; los grupos tienen `mode: all | any | none`; las relaciones tienen cuantificador `some | none | all | count` y una consulta aplicada a **cada mismo elemento** relacionado. Pueden anidarse relaciones en ambas direcciones. No se usa `eval`.

Ejemplo de árbol: Pokémon que aprenden un movimiento de Agua y Especial de potencia ≥ 80:

```js
{
  kind: 'relation', relation: 'moves', quantifier: 'some',
  query: { kind: 'group', mode: 'all', children: [
    { kind: 'condition', field: 'typeId', op: 'eq', value: 'water' },
    { kind: 'condition', field: 'category', op: 'eq', value: 'special' },
    { kind: 'condition', field: 'power.value', op: 'gte', value: 80 }
  ] }
}
```

Los controles de exploración y avanzados editan el mismo árbol. Las operaciones de conjunto admiten alguno, todos, ninguno y conjunto exacto. `none` en un grupo significa «no cumple ninguna», equivalente a negar `any`. Los valores de una lista avanzada se eligen con selección múltiple; los filtros rápidos de las demás tablas ofrecen casillas. El buscador normaliza tildes y mayúsculas; no admite expresiones regulares.

### Exploración visual de Pokémon

La vista Pokémon ofrece ejemplos editables de necesidades de equipo y un constructor en lenguaje natural para combinar habilidad, tipo, estadística, un movimiento aprendido, cobertura ofensiva, defensa por tipo y el rol exploratorio «Atacante para Espacio Raro». Las propiedades dentro de «Debe aprender un movimiento que…» se aplican al **mismo movimiento**. «Todos los campos» conserva el árbol general para grupos anidados y relaciones adicionales. Los resultados confirmados muestran testigos de las condiciones en «Por qué coincide»; los registros sin verificar explican el dato que falta y se ocultan cuando no hay ninguno. Los ejemplos sustituyen la búsqueda textual anterior para que un texto oculto no vacíe sus resultados.

La búsqueda de entradas de equipo empieza con 266 formas de la captura. Las 82 Mega Evoluciones y siete formas que aparecen solo durante el combate se consultan con «Incluir Mega y otras formas que aparecen solo en combate». Las fichas de estas últimas enlazan la forma de entrada para elegir movimientos. Esta clasificación evita presentar la lista reducida de Morpeko Voraz como una selección de equipo independiente. No representa una lista oficial exhaustiva de elegibilidad reglamentaria.

«Cobertura frente a todos los tipos» exige un movimiento ofensivo conocido que cause daño al menos neutral contra cada uno de los 18 tipos por separado. «Supereficaz contra un tipo» exige multiplicador mayor que 1. No se calculan combinaciones de dos tipos, daño real, disponibilidad simultánea en un set de cuatro movimientos ni la legalidad de una build. Los aprendizajes cerrados permiten descartar la ausencia de cobertura; las propiedades de movimientos aún indeterminadas conservan un resultado indeterminado.

Las etiquetas «Movimiento de cambio» y «Multigolpe» usan listas de IDs revisadas contra los datos de `pokemon-showdown` 0.11.11 y las descripciones publicadas. «Limita acciones del rival» usa exclusivamente `properties.coercion` de champout: Anulación, Atracción, Otra Vez, Tormento y Mofa. No incluye todo el apoyo o control de velocidad. Los IDs revisados están fijados en `site/move-tags.mjs`; la prueba de cobertura exige revisar cualquier ID nuevo antes de publicarlo.

### Cobertura y límites

La evaluación es trivalente: `true`, `false`, `null` (indeterminado). AND conserva falsos conocidos; OR conserva verdaderos conocidos; negar `null` devuelve `null`. Los registros indeterminados se muestran aparte como «Sin verificar» con el motivo; no se presentan como coincidencias. Una potencia variable es conocida como variable, pero su comparación numérica puede quedar indeterminada. «No aplicable» y una naturaleza neutra no son datos pendientes.

Las listas publicadas de tipos y habilidades de una forma son afirmaciones documentadas completas para ese campo. Cada lista de aprendizajes se certifica contra `personal`, `waza_learn` y las banderas `available` de la misma revisión de champout: toda forma válida publicada debe tener fila, cada movimiento de la fila debe publicarse o figurar como exclusión explícita, y no puede haber relaciones adicionales. El informe `data/reports/learnset-completeness.json` guarda la revisión, el hash del documento y las marcas de exhaustividad por forma y movimiento; una discrepancia detiene la actualización. La afirmación se limita a la captura, no a legalidad o vigencia posterior. Las asociaciones de combate permanecen abiertas sin prueba equivalente; ni cero pendientes ni cero resultados las cierran.

«Todos los relacionados cumplen» requiere al menos uno y cobertura del conjunto entero. Una cantidad abierta proporciona un límite inferior: ≥ 2 puede confirmarse con dos testigos, pero = 2 sigue indeterminado. Los agregados de ordenación se calculan sobre lo conocido; no representan totales o extremos completos del juego. La ordenación se hace antes de paginar, es estable por ID y conserva al final valores variables, no aplicables y pendientes, incluso al invertir el sentido.

Los selectores estructurados de las interacciones (por ejemplo, todos los movimientos de Agua) se resuelven mediante propiedades. Los productores de efectos distinguen vías directas y rutas de copia condicionadas; las últimas conservan los requisitos y la elegibilidad sin evaluar. Esto es un catálogo, no una simulación de legalidad, compatibilidad de cuatro movimientos o combate. Un reglamento sin restricciones documentadas no certifica legalidad.

## Carga y trazabilidad

`site/loader.mjs` carga primero el manifiesto, catálogo, cobertura compacta, tipos, especies, Pokémon y habilidades. Los demás JSON se cargan por demanda; los cruces cargan e indexan las relaciones una vez. Los más de 21.000 aprendizajes no generan miles de filas DOM.

Cada archivo de datos se verifica con SHA-256 contra el manifiesto. Ante una huella diferente se reintenta una vez sin reutilizar caché; si persiste, se muestra un error recuperable. El conjunto no se actualiza a mitad de una visita. Las evidencias se dividen por entidad y sus nombres contienen la huella de sus bytes; los índices que las referencian están vinculados al manifiesto. No se descargan los grandes registros de procedencia completos al abrir un registro. El código descarta respuestas de consultas o detalles que el usuario ya haya abandonado.

`site/catalog.mjs` proporciona etiquetas españolas, tipos, operadores y columnas. El empaquetador reconcilia las hojas observadas con los esquemas. Un campo nuevo sin etiqueta detiene la construcción para evitar omisiones silenciosas. Los valores técnicos nuevos pueden aparecer con su código hasta que se añada su traducción; no se inventan nombres oficiales pendientes. Las rutas dentro de arrays usan `*`, y el detalle conserva el contenido estructurado completo.

## GitHub Pages

El workflow `site.yml` ejecuta validaciones, construcción, Chromium y comprobación de reproducibilidad; sube el artefacto de Pages. Se ejecuta con push, pull request, manualmente o como workflow reutilizable. La actualización de datos lo llama con el SHA del commit ya publicado, porque el push realizado con `GITHUB_TOKEN` no inicia automáticamente otro workflow.

El repositorio público es [RASK18/ChampionsDB](https://github.com/RASK18/ChampionsDB). El despliegue queda desactivado hasta seleccionar **GitHub Actions** como origen de Pages y crear la variable de repositorio **PAGES_ENABLED=true**. El entorno `github-pages` debe permitir la rama `main`. Los trabajos de despliegue requieren `pages: write` e `id-token: write`; la actualización de datos conserva su permiso de escritura de contenidos. No se añade `CNAME` ni se cambia el dominio existente de disboard.es. Los recursos usan rutas relativas compatibles con `/ChampionsDB/`.

La CI conserva capturas y trazas de pruebas fallidas durante 14 días. Un fallo impide desplegar esa construcción y mantiene la publicación anterior. No hay cuentas, servicios externos de analítica, almacenamiento de preferencias ni service worker.
