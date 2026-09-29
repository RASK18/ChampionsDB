# Auditoría de datos de Pokémon Champions — 29-09-2026

## Alcance y revisión

La publicación usa la revisión `50e7233b78c3b81df29563f9695386c28e77fc95` de [champout](https://github.com/projectpokemon/champout), que seguía siendo `HEAD` cuando se comprobó el 29-09-2026. `masterdata` es un volcado del juego que puede cambiar sin parche; la revisión de Git no acredita por sí sola la versión exacta del juego ni la disponibilidad actual de cada forma. La captura suplementaria y el periodo oficial del reglamento figuran en `data/snapshot.json` y `data/regulations.json`.

## Afirmaciones que sí se pueden cerrar para esta captura

- Los 355 Pokémon/formas publicados tienen fila en `waza_learn`. Sus 22.251 parejas Pokémon–movimiento se reconcilian exactamente: 21.973 relaciones publicadas y 278 exclusiones respaldadas por `waza.available=0`. La actualización falla si falta una fila, una pareja, un movimiento o una exclusión. `data/reports/learnset-completeness.json` vincula estas marcas a la revisión y al SHA-256 de la tabla.
- Arbok tiene 70 movimientos en la captura y ninguno de los cinco movimientos de cambio revisados. «Intimidación y cambio» lo descarta; la consulta sobre las formas de entrada produce ocho coincidencias y cero registros sin verificar.
- Las 18 celdas por tipo de la matriz de efectividad, los tipos y las habilidades de las formas publicadas están presentes y validados por la canalización.
- Los 16 learnsets regionales cotejados con el [módulo vigente de Showdown para Champions](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/learnsets.ts) coincidieron por ID de movimiento. La comparación local de 207 formas base encontró 29 diferencias frente al paquete Showdown instalado, todas explicadas por el [anuncio oficial del 9 de septiembre](https://champions-news.pokemon-home.com/en/page/817.html): Cuchillada añadida a 28 fichas y las bajas indicadas de Politoed y Archaludon. Ese paquete local es anterior al parche y no se usa para sustituir la tabla de Champions.

## Formas que no son entradas independientes

De las 355 fichas, 82 son Mega Evoluciones y siete son formas que aparecen durante el combate: Castform Sol/Lluvia/Nieve, Aegislash Filo, Mimikyu Descubierta, Morpeko Voraz y Palafin Heroica. La búsqueda de entradas de equipo muestra inicialmente las otras 266, con opción para consultar también las formas de combate. La clasificación de estas siete formas se contrastó con `battleOnly`/`changesFrom` de [Showdown](https://github.com/smogon/pokemon-showdown/blob/master/data/pokedex.ts); la Mega Evolución se describe en la [norma oficial](https://champions-news.pokemon-home.com/en/page/816.html). Morpeko Voraz no debe usarse como fuente independiente para elegir movimientos: su lista capturada tiene cinco movimientos menos que la de su forma de entrada.

«266 formas de entrada» describe las fichas de combate publicadas tras esta separación. No es una certificación de que esas 266 sean reclutables o legales en todo modo de juego hoy. Tampoco incluye todas las presentaciones cosméticas posibles.

## Reglamento M-C: positivos y huecos

La lista enlazada desde el [reglamento oficial](https://champions-news.pokemon-home.com/en/page/816.html) se conserva por código de forma. Además, el [roster ordinario M-C](https://champions-news.pokemon-home.com/en/page/821.html) nombra expresamente Squawkabilly azul y blanco y el [roster especial](https://champions-news.pokemon-home.com/en/page/834.html) incluye Maushold familia de tres en el reglamento. Las tres afirmaciones positivas adicionales constan por separado en `eligiblePokemonFromNotices`.

El código oficial `0666-018` corresponde a Vivillon Motivo Fantasía. La tabla capturada contiene su fila y sus 43 aprendizajes: ahora se publica como `pokemon-0666018` y se enlaza al reglamento con ese código exacto. Motivo Polar permanece como ficha distinta. `eligibilityComplete` sigue en `false`, por lo que una ausencia de la lista no prueba inelegibilidad.

## Lo que sigue abierto

- `interactions/full-mechanics` es el pendiente global: los textos y asociaciones no describen todas las causas, excepciones ni condiciones de combate como reglas ejecutables.
- Doce movimientos tienen potencia variable. Una comparación numérica puede necesitar el estado del combate, aunque el catálogo de movimientos esté completo.
- De 154 interacciones documentadas, 129 tienen requisitos. «Puede provocar un efecto» significa capacidad condicionada, no garantía de que se active al usar una build.
- Ni la presencia en champout ni el roster parcial oficial certifican todas las formas reclutables, la legalidad de cuatro movimientos juntos, objetos, habilidades activas o el último estado del juego. [Champout](https://github.com/projectpokemon/champout) explica que `masterdata` puede actualizarse fuera de los parches; la [noticia del roster](https://champions-news.pokemon-home.com/en/page/821.html) remite al juego para la lista íntegra.

La actualización diaria vuelve a capturar las fuentes y bloquea una publicación si falla la reconciliación. Para afirmar más, se necesita evidencia específica de Champions de la forma que falta y una interpretación verificada de las mecánicas y restricciones todavía abiertas. Ocultar un registro sin verificar no aportaría esa evidencia.
