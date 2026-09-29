# Complementos limitados a los 147 huecos

Desde el 29 de septiembre de 2026, champout sigue siendo el origen principal. El alcance cerrado está en `rules/supplemental-scope.json`: otras fuentes solo completan esos huecos. La generación compara cada afirmación y evidencia de champout antes y después de añadir los complementos, y rechaza cualquier modificación.

| Pendientes originales | Complemento | Fuente |
| --- | --- | --- |
| 75 | Estadística aumentada, reducida y multiplicadores de 25 naturalezas | OP.GG Champions; multiplicadores del módulo Champions de Showdown |
| 18 | Filas de efectividad: 324 combinaciones | Matriz servida por OP.GG Champions |
| 40 | Identidad, disponibilidad, nombre y regla de 10 mecánicas generales | Módulo Champions de Showdown y funciones del motor que hereda |
| 7 | Seis objetivos y descripción de Forcejeo | OP.GG Champions |
| 2 | Restricciones de Bola Luminosa y Puerro | OP.GG Champions |
| 3 | Destino de Absolita, Garchompita y Lucarita | Objetos y formas de OP.GG Champions |
| 1 | Reglamento M-C: periodo, tiempos, cláusulas y lista oficial de Pokémon | Pokémon oficial |
| 1 | Todas las interacciones y excepciones aún sin estructurar | Continúa pendiente; es un marcador global, no un único campo |

La primera publicación completa 146 pendientes originales. Algunos marcadores se convierten en varias afirmaciones: por ejemplo, una transformación genera identidad, disponibilidad y regla. `data/reports/supplements.json` conserva la correspondencia exacta y su estado; `data/provenance/` registra cada evidencia.

Fuentes: [OP.GG Champions](https://op.gg/es/pokemon-champions), [Showdown Champions](https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions), [anuncio oficial M-C](https://champions-news.pokemon-home.com/es/page/816.html). Las capturas y revisiones exactas están en `data/snapshot.json`. No se exige doble proveedor, según la política acordada después del plan inicial.

## Interpretaciones y límites

Las diez reglas describen cálculo de estadísticas, daño, críticos, precisión/evasión, niveles de estadísticas, orden de turnos, cambios, megaevolución y copia de habilidades/movimientos. Son mecanismos principales, no un simulador completo: todas llevan `exceptionsComplete: false`. Las interpretaciones en `rules/supplemental-reviewed.json` están ligadas a fragmentos y SHA-256; cambiar el fragmento las devuelve a pendientes. No se importa como disponibilidad de Champions el catálogo genérico de otra entrega.

El reglamento contiene la lista oficial completa por nombre y referencias solo a formas identificadas en champout. Vivillon queda en `unmappedPokemonNames` porque el código de forma oficial no está en el catálogo principal. No se añade una forma nueva fuera del alcance. `eligibilityComplete: false` evita presentar esta información como validación completa de un equipo; las transformaciones durante el combate tienen sus propias reglas. El periodo se comprueba con la fecha de la captura, sin deducir vigencia a partir del commit de champout.

## Actualización

`npm run data:update` captura las fuentes, mantiene champout prioritario e incorpora exclusivamente complementos autorizados. `npm run data:rebuild` repite la generación sin red con las capturas guardadas. `npm run data:validate` comprueba esquemas, relaciones y la autorización de cada evidencia externa. Un fallo de descarga o de formato conserva la publicación anterior.

No se amplía automáticamente la lista de 147: un nuevo hueco de champout queda pendiente. Cuando champout aporta un campo antes suplementario, su dato pasa a tener prioridad. Si caduca el reglamento M-C, deja de publicarse como vigente; incorporar otro reglamento exige revisar el anuncio y el alcance correspondiente.
