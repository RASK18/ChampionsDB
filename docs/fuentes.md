# Fuentes de datos para ChampionsDB

Investigación realizada el 28 de septiembre de 2026. Objetivo: tablas con filtros de Pokémon Champions en español de España, publicadas en `https://disboard.es/ChampionsDB/`.

## Recomendación

Evaluar **Project Pokémon / champout como fuente principal**, con los textos `esp`, y contrastar los datos publicados con las notas oficiales y las secciones específicas de Champions de Serebii. Usar el módulo Champions de Pokémon Showdown como apoyo para interpretar mecánicas y construir filtros avanzados. WikiDex y Vandal sirven como referencias editoriales en español.

Esta investigación selecciona fuentes; todavía no constituye una auditoría completa de sus registros ni una importación de datos.

Ampliación: **OP.GG se incorpora como referencia de contraste prioritaria en español**, por su cobertura de datos y propiedades de combate. Showdown Tier se evaluó durante la investigación, pero **queda fuera del aprovisionamiento**: esta fase excluye estadísticas competitivas, tiers, uso y winrates. La implementación y su cobertura efectiva se documentan en [aprovisionamiento.md](aprovisionamiento.md).

## Fuentes evaluadas

### 1. Project Pokémon: champout — primera opción para importar

- [Repositorio y explicación de procedencia](https://github.com/projectpokemon/champout).
- [Tablas de datos](https://github.com/projectpokemon/champout/tree/main/masterdata): `personal.json`, `waza.json`, `waza_learn.json`, `item.json`.
- [Textos del juego por idioma](https://github.com/projectpokemon/champout/tree/main/rom-txt): separa `esp` de `latam`.
- [Datos interpretados](https://github.com/projectpokemon/champout/tree/main/parse): estadísticas, tipos, habilidades y movimientos por Pokémon, además de disponibilidad de movimientos.
- [Historial](https://github.com/projectpokemon/champout/commits/main/): contiene actualizaciones de tablas, datos interpretados y textos españoles para la versión 1.2.0, fechadas el 9 de septiembre de 2026.

El propio proyecto identifica los datos como extracciones de Champions para Nintendo Switch. Distingue textos de la ROM de tablas descargables que pueden cambiar sin actualizar el ejecutable. Esto permite reducir la dependencia de tablas copiadas de otras entregas.

Uso propuesto: estadísticas y relaciones entre entidades desde las tablas; nombres y descripciones desde `rom-txt/esp`. Fijar un commit al generar cada publicación. Interpretar los identificadores y los campos antes de importar: que un registro exista en los archivos no demuestra por sí solo que esté disponible o permitido en un reglamento.

Verificado: estructura, procedencia declarada, historial y muestra del archivo de estadísticas y movimientos. Pendiente: inspección completa de los textos españoles, semántica de disponibilidad y cobertura de cada tabla. El navegador no pudo recuperar el contenido de la carpeta `esp`, aunque su existencia y actualización aparecen en el árbol y el historial.

### 2. Pokémon y Nintendo España — autoridad para anuncios y cambios

- [Pokémon Champions, sección Pokémon en es-ES](https://champions.pokemon.com/es-es/pokemon/).
- [Notas de actualización de Nintendo España](https://www.nintendo.com/es-es/Ayuda/Compras-y-suscripciones/Juegos/Como-actualizar-Pokemon-Champions-3079895.html).

Sirven para confirmar nombres publicados, funcionamiento, incorporaciones y cambios de versión. Las páginas revisadas no ofrecen una base completa descargable con todos los Pokémon y sus relaciones.

Ejemplo comprobado: las notas de la versión 1.2.0 indican que Deseo y Absorbefuerza pasan de 12 a 8 PP. También retiran Destructor a Politoed, Manto Espejo y Represión Metal a Archaludon, y permiten Cuchillada. Son casos concretos para comprobar la actualización de una futura importación.

### 3. Serebii — contraste especializado en Champions

- [Pokédex exclusiva de Champions](https://www.serebii.net/pokedex-champions/).
- [Ficha de Rotom en Champions](https://www.serebii.net/pokedex-champions/rotom/).

La sección diferencia expresamente Champions de la Pokédex general de novena generación. Incluye formas, estadísticas, habilidades y movimientos. Es una buena referencia para verificar muestras y resolver discrepancias.

Está en inglés: no debe determinar las traducciones españolas. Utilizar exclusivamente las secciones de Champions al validar datos específicos del juego; seguir un enlace hacia una sección general puede cambiar el contexto.

### 4. Pokémon Showdown — datos estructurados y mecánicas

- [Módulo específico de Champions](https://github.com/smogon/pokemon-showdown/tree/master/data/mods/champions).
- [Implementación de reglas y cálculos](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/scripts.ts).

Contiene archivos de movimientos, habilidades, objetos, movimientos aprendibles y reglas. Resulta útil para filtros por propiedades de combate y como comprobación técnica. El código revisado incluye una transformación de PP: copiar directamente el campo `pp` puede dar un valor distinto al mostrado en Champions.

Uso propuesto: apoyo técnico, resolviendo el módulo y el formato concreto. No importar sin filtrar la base general ni confundir formatos de comunidad, como National Dex, con la disponibilidad real del juego. No aporta por sí solo una localización completa en castellano.

### 5. WikiDex — referencia en español

- [Artículo de Pokémon Champions](https://www.wikidex.net/wiki/Pok%C3%A9mon_Champions).
- [Lista específica de Pokémon y fechas de incorporación](https://www.wikidex.net/wiki/Lista_de_Pok%C3%A9mon_de_Pok%C3%A9mon_Champions).

Útil para nomenclatura, explicaciones y comprobaciones de disponibilidad. La lista específica incluye fechas de incorporación. La web cubre toda la franquicia y también muestra variantes regionales del español; hay que seleccionar castellano y verificar el contexto de cada sección. Una ficha general de una especie no demuestra sus movimientos legales en Champions.

### 6. Vandal — tablas legibles en castellano, con revisión de vigencia

- [Guía de Champions](https://vandal.elespanol.com/guias-amp/guia-pokemon-champions-trucos-consejos-y-secretos).
- [Tabla de movimientos](https://vandal.elespanol.com/guias/guia-pokemon-champions-trucos-consejos-y-secretos/movimientos).

Tiene tablas con nombre, tipo, categoría, potencia, PP, precisión y efectos. Es cómoda para consultar terminología, pero se ha comprobado una discrepancia: Deseo aparece con 12 PP frente a los 8 de las notas oficiales de la versión 1.2.0. Por ello no se recomienda como origen único de los valores actuales.

### 7. PokéAPI — complemento sujeto a comprobación por campo

- [Documentación](https://pokeapi.co/docs/v2).
- [Grupos de versiones del repositorio](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/version_groups.csv): incluye `champions`, con ID 32.

Puede aportar identificadores y nombres localizados. Sí existe un grupo específico de Champions, pero eso no garantiza que todos los campos genéricos ni todas las especies tengan cobertura completa para ese juego. Habría que medirla antes de usarla para estadísticas, efectos o movimientos aprendibles. No sustituir un dato ausente de Champions por uno de Escarlata/Púrpura o Leyendas: Z-A.

### 8. OP.GG — referencia amplia en español y candidata a fuente complementaria

- [Portal de Champions en español](https://op.gg/es/pokemon-champions).
- [Movimientos](https://op.gg/es/pokemon-champions/moves).
- [Ficha de Deseo](https://op.gg/es/pokemon-champions/moves/wish).
- [Explicación del desarrollo y recopilación de datos](https://log.op.gg/we-borrowed-a-nintendo-from-work-and-one-more-site-was-born/).

Ofrece Pokédex, habilidades, objetos, movimientos, estados, naturalezas, estadísticas competitivas y equipos. La ficha de Deseo incluye PP, prioridad, objetivo, contacto y Pokémon relacionados; esos campos encajan con los filtros previstos. En la consulta muestra 8 PP, coincidiendo con las notas oficiales de la versión 1.2.0. Esta comprobación puntual no valida todo el catálogo.

La interfaz española contiene términos poco naturales, como la traducción del título a «Campeones Pokémon», y fragmentos en inglés. No se ha verificado que toda su localización corresponda al castellano oficial del juego. Su artículo técnico describe el uso de una API y extracción de otras páginas, pero no identifica suficientemente la procedencia de cada conjunto para reproducirlo. Tampoco se ha encontrado en las páginas consultadas una exportación o API pública documentada para Champions, ni una explicación precisa de la muestra de sus rankings.

Recomendación: referencia de contraste con prioridad superior a las guías editoriales revisadas. Antes de automatizar una importación, verificar acceso estable, procedencia y correspondencia de los campos. Mantener los textos `esp` del juego como referencia lingüística preferida.

### 9. Showdown Tier — estadísticas de combates del simulador

- [Formatos disponibles](https://showdowntier.com/index.html).
- [Metodología](https://showdowntier.com/methodology.html).
- [VGC 2026 M-C](https://showdowntier.com/formats/dmc/index.html).
- [Procedencia y limitaciones](https://showdowntier.com/about.html).

Publica uso, victorias, rating, emparejamientos y análisis de equipos. Su metodología declara muestreo de combates públicos de Pokémon Showdown, ventana móvil de 14 días, procesamiento diario e inclusión en los informes a partir del 1 % de uso. La tasa de victoria mide resultados de equipos que incluyen al Pokémon; no su contribución individual.

El portal separa VGC y BSS de Champions por reglamento, pero también contiene OU y formatos de otras entregas. Importar únicamente formatos explícitamente seleccionados. No presentar estas cifras como estadísticas de partidas jugadas directamente en Champions ni interpretar la ausencia de una especie en el informe como ilegalidad.

Las páginas revisadas están en inglés. No se ha encontrado una API pública o descarga documentada en ellas. Es una fuente candidata para enriquecer filtros de metajuego, no para determinar los movimientos aprendibles o el catálogo completo. Guardar fuente, formato, periodo, tamaño de muestra y definición de cada métrica; no promediar sus porcentajes con los de otro proveedor sin comprobar que miden lo mismo.

### Alternativas con menor prioridad

- [PchamDB](https://pchamdb.com/es/): portada en español y herramientas de filtros interesantes; algunos enlaces consultados conducen a páginas japonesas. No se ha verificado una exportación documentada, la integridad del castellano ni la procedencia detallada de cada dato.
- [otterlyclueless/pokemon-champions-data](https://github.com/otterlyclueless/pokemon-champions-data): su README reconoce que parte de los datos generales de Showdown y solicita verificar diferencias propias de Champions. No se recomienda como fuente principal pese al nombre del repositorio.

## Reglas para evitar mezclar juegos o versiones

1. Obtener los valores de combate y las relaciones Pokémon-movimiento de fuentes específicas de Champions.
2. Mantener separadas especie, forma regional, megaevolución y otras formas relevantes para combate.
3. Distinguir presencia en archivos, disponibilidad en el juego y legalidad en cada reglamento.
4. Usar identificadores para enlazar entidades; los nombres españoles son etiquetas, no claves.
5. Guardar fuente, commit o revisión, fecha de consulta, versión y reglamento aplicable.
6. Mantener los datos sin comprobar como pendientes; no rellenarlos silenciosamente con otra entrega.
7. Contrastar una muestra que incluya cambios de versión antes de publicar una actualización.

## Consecuencia para la arquitectura

Propuesta inicial: **HTML, CSS y JavaScript nativos, con archivos JSON locales**. Un script de preparación convertiría las fuentes seleccionadas a esos JSON antes de publicar. Los filtros se ejecutarían en el navegador y no necesitarían consultar servicios externos durante el uso de la web.

Separar los datos en Pokémon/formas, movimientos, habilidades, objetos, relaciones de aprendizaje y reglamentos. Añadir un manifiesto pequeño con la procedencia y versión del conjunto. Para filtros por efectos, guardar propiedades estructuradas, no buscar palabras en las descripciones.

Usar rutas relativas compatibles con `/ChampionsDB/`. La primera implementación no necesita framework, servidor de aplicación ni base de datos. Esta es una propuesta de arquitectura; esta fase solo añade documentación de investigación.
