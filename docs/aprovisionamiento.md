# Aprovisionamiento y procedencia

La fuente principal es [Project Pokémon / champout](https://github.com/projectpokemon/champout). La política está en `sources/policy.json` y se copia al manifiesto. Sustituye la exigencia inicial de dos proveedores por decisión del propietario. Desde el 29 de septiembre, OP.GG, Showdown y Pokémon oficial aportan solo los [complementos autorizados](suplementos.md). Ningún complemento sustituye una afirmación de champout.

## Tablas y textos

Cada ejecución fija un commit y captura `personal`, `waza`, `waza_learn`, `item` y textos `esp`/`usa`. `esp` aporta la redacción española; `usa` identifica tipos, naturalezas y clases de forma. El adaptador activo es `scripts/lib/champout.mjs`. Los adaptadores anteriores y `rules/reviewed.json` se conservan como material histórico; el comando de actualización no los llama.

Los nombres de forma se combinan con la especie cuando el texto solo dice «Forma Sol», «Forma de Hisui», etc. Los movimientos aprendibles se leen por forma, sin herencia. Se excluyen las variantes puramente cosméticas indicadas en `mappings.json`. Las banderas `is_valid` y `available` delimitan Pokémon y movimientos. Los objetos proceden de la tabla de objetos de combate; `unlock` no indica legalidad o disponibilidad actual. Las habilidades se obtienen de las asignaciones de los Pokémon.

**La presencia en el volcado no acredita legalidad ni actualidad del último parche.** La versión del juego y el reglamento no se deducen de la fecha del commit. La versión sigue en `null`; el reglamento se identifica con su anuncio oficial y periodo vigente en la captura; la web muestra la revisión de champout. Un cambio oficial que todavía no haya llegado a champout tampoco aparecerá aquí.

## Interpretación y evidencia

Cada afirmación tiene al menos una evidencia de champout o de un proveedor autorizado para ese hueco concreto. Se conserva documento, localizador, valor observado, valor normalizado, revisión, captura y SHA-256. Varios textos o tablas del mismo proveedor siguen siendo una sola fuente. El validador rechaza cualquier evidencia externa que no figure en el alcance cerrado y en la lista de proveedores autorizados para la afirmación. La generación verifica además que todos los datos y evidencias publicados por champout permanezcan idénticos tras incorporar los complementos.

Los PP son los efectivos del volcado. El peso se convierte a kg. Los códigos de objetivos de `waza` no son los índices de `wazatarget`; la normalización conserva sin interpretar los códigos cuyo significado no está documentado suficientemente. `con_ref` y `buf_ref` son asociaciones: no implican causalidad por sí solos.

Las reglas de interpretación están en `rules/champout-reviewed.json`, vinculadas a hashes de textos concretos. Incluyen climas, estados, bayas, copia de habilidades y potencias especiales. Si cambia un texto, la interpretación queda pendiente, pero el texto nuevo sigue disponible. `rules/champout-mappings.json` conserva los identificadores de efectos y su clasificación. Las transformaciones combinan restricciones del objeto, descripción y formas de la especie; los destinos ambiguos quedan sin inventar.

## Límites

Los complementos proporcionan matriz de tipos, modificadores de naturalezas, reglas generales y reglamento. Las reglas generales describen mecanismos principales y marcan `exceptionsComplete: false`: no equivalen a todas las excepciones de un simulador. Los textos se publican completos aunque sus reglas estructuradas no estén terminadas. Por eso `complete` permanece en `false`.

Los informes mantienen registros y campos esperados/publicados, huecos e interpretaciones por completar. `excluded.json` recoge las banderas explícitas de exclusión; `withdrawn.json`, las bajas explícitas respecto de la publicación anterior. Una fila que desaparece sin una bandera negativa se considera ausente, no retirada. `stale.json` separa valores anteriores que ya no pueden publicarse bajo la política actual; no se consultan como datos vigentes.

Velo Arena conserva la inmunidad al daño de tormenta de arena; Viscosecreción toma su nombre del texto `esp`; Batería Asalto y su relación con Rillaboom proceden de `waza` y `waza_learn`. Las diferencias con los nombres, resúmenes o banderas de OP.GG ya no bloquean estos datos.
