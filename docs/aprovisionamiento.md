# Aprovisionamiento y procedencia

La publicación utiliza catálogos específicos de Pokémon Champions. La extracción inicial contrasta champout y OP.GG, incorpora el módulo Champions resuelto de Showdown, y usa páginas de Serebii, Nintendo y Pokémon para disponibilidad de objetos, estados, cambios y reglamentos. El detalle actualizado está en `sources/providers.json` y en el manifiesto de capturas de cada publicación.

## Adaptadores

**champout.** Se fija un commit de `projectpokemon/champout` y se leen `personal`, `waza`, `waza_learn` e `item`, junto con tablas de textos `esp`. `usa` solo resuelve identidades y correspondencias. Nunca se utiliza `latam` como traducción castellana. La tabla de aprendizaje se trata por forma. El peso se convierte de hectogramos a kg. El indicador de desbloqueo de un objeto no se interpreta como disponibilidad de combate.

**OP.GG.** Se extraen los datos estructurados del HTML de las páginas de Champions mediante un lector de React Flight que interpreta JSON, sin evaluar JavaScript. Los cambios de formato y las referencias desconocidas provocan un fallo. La matriz de tipos procede del fragmento JavaScript utilizado por la propia página; se lee como un literal de datos, sin ejecutarlo. Los objetos de economía y tickets quedan fuera del inventario de combate. Las asociaciones con un estado o clima no se convierten automáticamente en relaciones causales.

**Showdown.** Se fija por ejecución el commit de los datos base y de `data/mods/champions`. El cargador de la dependencia fijada resuelve las herencias del módulo Champions y su inicialización. Node elimina las anotaciones TypeScript; solo se ejecuta código procedente de ese repositorio fijado. Una nueva importación de runtime requiere revisión. El cargador es una dependencia de preparación y no se sirve al navegador.

No se usa el catálogo general de Showdown como prueba de disponibilidad: se necesita evidencia específica del módulo Champions o de otra fuente del juego. Los PP de Showdown pueden retrasarse respecto de los parches; se contrastan los PP efectivos de champout y OP.GG. En las capturas iniciales Deseo y Absorbefuerza tienen 8 PP, mientras Showdown aún conserva valores anteriores en su representación interna.

**Serebii y fuentes oficiales.** Se interpretan las páginas de Champions sobre objetos, estados y reglamentos, además de las notas de Nintendo para retiradas explícitas. Se capturan también páginas de actualización y entrenamiento para auditoría y ampliación del inventario. Capturar una página no significa haber interpretado todos sus contenidos ni haberlos validado.

## Qué significa doble validación

Cada afirmación se agrupa por `colección/id/campo`. Se normalizan unidades, IDs, espacios y categorías. Las cifras deben coincidir exactamente. Dos páginas del mismo proveedor no cuentan como dos fuentes. Un valor con observaciones contradictorias queda pendiente, incluso si dos observaciones coinciden, salvo resolución revisada y vinculada a las observaciones concretas.

Los proveedores son distintos, pero **no se afirma independencia de origen**. OP.GG declara usar APIs y scraping sin identificar todos los proveedores subyacentes. Showdown y sitios editoriales pueden compartir fuentes. Estas dependencias y dudas están registradas; una copia conocida debe conservar el mismo identificador de proveedor.

Las descripciones solo se aprueban por igualdad normalizada o por equivalencias revisadas en `rules/reviewed.json`. Cada equivalencia mantiene el texto observado y su huella. No se utiliza similitud textual ni una aprobación automática por IA. Los casos especiales y sus requisitos también están vinculados a las huellas de los textos que los justifican: si cambian, quedan pendientes.

## Evidencia y cobertura

`data/provenance/<colección>.json` contiene un mapa de afirmaciones y otro de observaciones compartidas. Cada afirmación señala sus testigos por hash; cada testigo guarda proveedor, documento, localizador, valor observado, valor normalizado, contexto y huella del documento. `data/snapshot.json` resuelve cada documento a su URL, revisión, fecha y huella de captura. La deduplicación evita repetir miles de veces las mismas observaciones.

Los informes distinguen:

- `coverage.json`: registros y campos esperados/publicados, asociaciones sin clasificar y `complete`.
- `pending.json`: cada hueco, desacuerdo, extremo ausente o evidencia de revisión invalidada.
- `mappings.json`: correspondencias y exclusiones explícitas, incluidas las variantes puramente cosméticas.
- `excluded.json`: indisponibilidad corroborada por dos proveedores, con evidencia, incluidas retiradas explícitas de movimientos aprendibles.
- `withdrawn.json`: bajas verificadas respecto de la publicación anterior.
- `stale.json`: valores de la publicación anterior que han dejado de tener corroboración; no forman parte de las consultas actuales.
- `changes.json`: altas y cambios respecto de la publicación anterior; se conserva en ejecuciones sin cambios.

El inventario es la unión de los catálogos capturados, incluidas las formas y relaciones que solo conoce una fuente. La lista de efectos de OP.GG se usa también para inventariar asociaciones no interpretadas. La medición no afirma que se hayan descubierto todas las interacciones posibles del juego: las mecánicas generales aún no resueltas figuran como pendientes y la cobertura permanece incompleta.

## Límites de esta entrega

Hay datos aprovisionados y consultas funcionales, pero aún faltan descripciones equivalentes, categorías de efectos, excepciones, varias formas/relaciones y buena parte de las reglas generales y restricciones detalladas. El informe generado es la referencia exacta; no se presenta “toda la información del juego” como terminada.

El reglamento con dos fuentes configuradas es M-C. Sus horas exactas no se deducen de una segunda fuente que solo da fechas: el periodo publicado tiene precisión de día. Los futuros reglamentos requieren incorporar sus anuncios específicos y contrastes, sin reutilizar la legalidad de M-C. Las nuevas mecánicas que el modelo no interprete también requieren nuevas reglas revisadas.
