# Modelo de combate

Cada colección es un array ordenado por `id`. Los identificadores no dependen de las traducciones: `pokemon-0003001` conserva el identificador de forma de champout, `species-003` agrupa la especie y movimientos, habilidades y objetos usan identificadores numéricos. Tipos, efectos y naturalezas tienen claves estables documentadas por los proveedores. Los cruces se guardan en `data/reports/mappings.json`.

| Archivo | Contenido y relaciones canónicas |
| --- | --- |
| `types.json` | Nombres y matriz atacante → defensor, con una afirmación por fila que conserva las 18 celdas. |
| `species.json` | Identidad común, nombre y número nacional. |
| `pokemon.json` | Forma, `speciesId`, tipos, seis estadísticas base por separado, peso en kg, sexo y habilidades posibles. |
| `learnsets.json` | Una fila por pareja `pokemonId` → `moveId`; no hereda movimientos entre formas. |
| `moves.json` | Nombre, texto contrastado, tipo, categoría, potencia, precisión, PP efectivos, prioridad, objetivo y propiedades. |
| `abilities.json` | Nombre y descripción documentados; sus mecánicas están en interacciones. |
| `items.json` | Nombre, descripción, categoría (`berry`, `mega-stone`, `held-item`) y restricciones contrastadas. |
| `effects.json` | Clima, terreno, estado principal, efecto volátil o efecto de campo/equipo. Los estados no se duplican en otro archivo. |
| `interactions.json` | Reglas dirigidas que crean, curan, impiden, prolongan, suprimen, potencian, reducen, copian o transforman. |
| `natures.json` | Estadística que sube/baja y multiplicadores; las neutras usan `null`, `null`, `1`, `1`. |
| `battle-rules.json` | Mecánicas de champout y reglas principales del módulo Champions de Showdown; excepciones completas sin certificar. |
| `regulations.json` | Identidad, periodo con precisión explícita y restricciones documentadas del reglamento. |

`identity: true` y `available: true` describen la identidad y presencia/banderas de las tablas de champout o, en los complementos autorizados, su documentación en la fuente indicada. Un registro puede ser parcial: no se completan sus huecos con datos generales de Escarlata/Púrpura ni de otras entregas. La disponibilidad general tampoco equivale a legalidad en todos los reglamentos.

La matriz de efectividades, los modificadores de naturalezas y el reglamento se completan mediante el alcance cerrado de complementos. `items.restrictions` recoge la restricción de formas de `personal_usepoke`, no legalidad de equipo o reglamento. Los dos huecos autorizados de Bola Luminosa y Puerro se resuelven con las especies indicadas por OP.GG. Las demás ausencias siguen pendientes.

## Valores incompletos y semántica

- Propiedad ausente: desconocida, contradictoria o sin dato en la fuente; consultar pendientes.
- `{ "kind": "not-applicable" }`: potencia o precisión no aplicable, documentada.
- `{ "kind": "variable" }`: potencia variable; los marcadores `0`, `1` o `null` del proveedor por sí solos no demuestran esto. Los casos especiales necesitan descripciones o mecánicas contrastadas.
- Los movimientos que infligen daño fijo, proporcional, de respuesta o debilitamiento directo tienen potencia `not-applicable`; su fórmula sigue en la descripción. Esto no equivale a potencia cero.
- Potencia fija: `{ "kind": "fixed", "value": 90 }`.
- Precisión: `{ "kind": "percent", "value": 100 }`. El marcador `101` de la tabla del juego se normaliza como precisión no aplicable.
- Matriz de tipos: `0` significa inmunidad; `0.5`, `1` y `2` son multiplicadores.
- Array vacío publicado: lista explícita contrastada; no sirve para ocultar datos desconocidos. Los resultados vacíos de consultas incluyen cobertura y no prueban imposibilidad.
- Las naturalezas neutras usan `null` como “no modifica esta estadística”, no como valor desconocido.
- Las probabilidades declaradas como fracción y los porcentajes mostrados en textos no se confunden. Por ejemplo, el 33 % mostrado para sueño se conserva como porcentaje mostrado, sin fingir precisión matemática adicional.

## Interacciones

Ejemplo abreviado de creación de Lluvia:

```json
{
  "source": {"collection": "abilities", "id": "ability-002"},
  "target": {"collection": "effects", "id": "rain"},
  "relation": "causes",
  "trigger": "on-entry",
  "recipient": "field",
  "requirements": {"all": []},
  "parameters": {"duration": {"turns": 5}}
}
```

`all`, `any` y `not` combinan predicados estructurados. Un selector como `{"collection":"moves","selector":{"typeId":"water"}}` describe todos los movimientos de Agua sin duplicar relaciones. Los requisitos modelan condiciones conocidas; `all: []` significa que esa regla no enumera requisitos adicionales, **no** que se hayan descartado todas las excepciones posibles del motor de combate.

Las transformaciones enlazan el objeto con la forma de destino y exigen la forma de origen y el objeto equipado. Sus extremos y los identificadores dentro de requisitos también se validan. La consulta inversa se construye desde los datos canónicos; no hay listas inversas mantenidas a mano.

Los índices de `lib/queries.mjs` permiten buscar titulares de habilidades, aprendices de movimientos, formas de una especie y rutas hacia un efecto. Las rutas de copia permanecen condicionales: necesitan un rival con la habilidad correspondiente, que esta sea copiable y que se active. Esto es un catálogo de reglas, no un simulador.

## Esquemas

Hay un JSON Schema por colección en `schemas/`. `node scripts/build-schemas.mjs` los regenera desde el modelo declarativo. Ajv valida todo el conjunto y las comprobaciones adicionales revisan unicidad, extremos de relaciones, duplicados, 324 celdas de tipos y evidencia por cada propiedad publicada. Los objetos compuestos de reglas se contrastan completos contra las evidencias de su revisión.
