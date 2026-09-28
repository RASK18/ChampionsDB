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

Los ocho accesos principales incluyen vistas adicionales de especies, aprendizajes, interacciones y reglamentos. Las tablas usan 50 filas por página (25/50/100), columna de identificación y cabecera fijas. El selector de columnas ofrece todos los campos, incluidos los parámetros y requisitos anidados. La tabla de tipos permite alternar a la matriz atacante → defensor. El detalle incluye campos, relaciones y evidencias a petición.

La configuración se conserva en memoria por sección y se pierde al recargar. No se escriben preferencias en localStorage, sessionStorage, cookies ni URL. El tema inicial sigue el sistema; el cambio manual dura la visita. Los enlaces a una tabla relacionada reemplazan su consulta por una selección explícita, que admite nuevas condiciones y puede eliminarse desde el editor avanzado.

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

Los controles rápidos y avanzados editan el mismo árbol. Las operaciones de conjunto admiten alguno, todos, ninguno y conjunto exacto. `none` en un grupo significa «no cumple ninguna», equivalente a negar `any`. Los valores de una lista avanzada se eligen con selección múltiple; los filtros rápidos ofrecen casillas. El buscador normaliza tildes y mayúsculas; no admite expresiones regulares.

### Cobertura y límites

La evaluación es trivalente: `true`, `false`, `null` (indeterminado). AND conserva falsos conocidos; OR conserva verdaderos conocidos; negar `null` devuelve `null`. Los posibles se muestran aparte con el motivo. Una potencia variable es conocida como variable, pero su comparación numérica puede quedar indeterminada. «No aplicable» y una naturaleza neutra no son datos pendientes.

Las listas publicadas de tipos y habilidades de una forma son afirmaciones corroboradas completas para ese campo. Los aprendizajes y las asociaciones de combate permanecen abiertos salvo evidencia explícita de exhaustividad; ni cero pendientes ni cero resultados demuestran que una relación sea imposible. El índice de disponibilidad conserva pendientes y exclusiones por referencia, y admite marcas de exhaustividad `relations['colección/id/relación']`. El constructor no inventa esas marcas.

«Todos los relacionados cumplen» requiere al menos uno y cobertura del conjunto entero. Una cantidad abierta proporciona un límite inferior: ≥ 2 puede confirmarse con dos testigos, pero = 2 sigue indeterminado. Los agregados de ordenación se calculan sobre lo conocido; no representan totales o extremos completos del juego. La ordenación se hace antes de paginar, es estable por ID y conserva al final valores variables, no aplicables y pendientes, incluso al invertir el sentido.

Los selectores estructurados de las interacciones (por ejemplo, todos los movimientos de Agua) se resuelven mediante propiedades. Los productores de efectos distinguen vías directas y rutas de copia condicionadas; las últimas conservan los requisitos y la elegibilidad sin evaluar. Esto es un catálogo, no una simulación de legalidad, compatibilidad de cuatro movimientos o combate. Un reglamento sin restricciones corroboradas no certifica legalidad.

## Carga y trazabilidad

`site/loader.mjs` carga primero el manifiesto, catálogo, cobertura compacta, tipos, especies, Pokémon y habilidades. Los demás JSON se cargan por demanda; los cruces cargan e indexan las relaciones una vez. Los más de 21.000 aprendizajes no generan miles de filas DOM.

Cada archivo de datos se verifica con SHA-256 contra el manifiesto. Ante una huella diferente se reintenta una vez sin reutilizar caché; si persiste, se muestra un error recuperable. El conjunto no se actualiza a mitad de una visita. Las evidencias se dividen por entidad y sus nombres contienen la huella de sus bytes; los índices que las referencian están vinculados al manifiesto. No se descargan los grandes registros de procedencia completos al abrir un registro. El código descarta respuestas de consultas o detalles que el usuario ya haya abandonado.

`site/catalog.mjs` proporciona etiquetas españolas, tipos, operadores y columnas. El empaquetador reconcilia las hojas observadas con los esquemas. Un campo nuevo sin etiqueta detiene la construcción para evitar omisiones silenciosas. Los valores técnicos nuevos pueden aparecer con su código hasta que se añada su traducción; no se inventan nombres oficiales pendientes. Las rutas dentro de arrays usan `*`, y el detalle conserva el contenido estructurado completo.

## GitHub Pages

El workflow `site.yml` ejecuta validaciones, construcción, Chromium y comprobación de reproducibilidad; sube el artefacto de Pages. Se ejecuta con push, pull request, manualmente o como workflow reutilizable. La actualización de datos lo llama con el SHA del commit ya publicado, porque el push realizado con `GITHUB_TOKEN` no inicia automáticamente otro workflow.

El despliegue queda desactivado hasta configurar un remoto de GitHub, seleccionar **GitHub Actions** como origen de Pages y crear la variable de repositorio **PAGES_ENABLED=true**. El entorno `github-pages` debe permitir la rama `main`. Los trabajos de despliegue requieren `pages: write` e `id-token: write`; la actualización de datos conserva su permiso de escritura de contenidos. No se añade `CNAME` ni se cambia el dominio existente de disboard.es. Los recursos usan rutas relativas compatibles con `/ChampionsDB/`.

La CI conserva capturas y trazas de pruebas fallidas durante 14 días. Un fallo impide desplegar esa construcción y mantiene la publicación anterior. No hay cuentas, servicios externos de analítica, almacenamiento de preferencias ni service worker.
