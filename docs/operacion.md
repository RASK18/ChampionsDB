# Operación y actualización

## Preparación

Usar Node.js 24 y ejecutar `npm ci`. `.npmrc` omite dependencias opcionales de servidor de Showdown y scripts de instalación innecesarios. Solo se carga su módulo Dex. `package-lock.json` fija las dependencias; las fuentes de datos remotas se fijan por ejecución y se registran aparte.

`npm run data:update` realiza descarga → normalización por proveedor → resolución de IDs → contraste → construcción → validación integral → publicación. Las descargas tienen tres intentos, tiempo límite y un máximo de tres conexiones simultáneas. Las capturas inmutables se reutilizan por URL y huella; las páginas vivas se vuelven a consultar.

Los scripts no importan estadísticas competitivas al modelo. Las capturas crudas de una página pueden contener información ajena al alcance, como navegación o rankings del proveedor; permanecen en la caché de auditoría, no en los JSON de consulta.

## Reconstrucción sin red

Se necesitan el código y bloqueo de dependencias de la revisión correspondiente, las reglas revisadas, `sources/snapshot.json` y todos los objetos referidos en `.cache/objects/`. Las capturas están disponibles en este workspace después del aprovisionamiento inicial.

```sh
npm run data:rebuild
npm run data:validate
```

En una copia nueva del repositorio, recuperar el artefacto `champions-evidence-<run_id>` de GitHub Actions y restaurar `.cache/objects/` y `sources/snapshot.json` conservando sus rutas. Una URL de una página viva no sustituye una captura histórica: si ya cambió, no permite reconstruir la misma evidencia. Las capturas no se añaden a Git; el historial de publicaciones verificadas sí.

Cada objeto se comprueba contra su SHA-256 antes de interpretarlo. El contenido generado es determinista para las mismas capturas, reglas, código y publicación anterior. Esta última es una entrada para los informes de cambios y valores que han perdido corroboración. Repetir una ejecución sin cambios no modifica los archivos ni prepara un commit nuevo.

También puede utilizarse `node scripts/update.mjs --snapshot ruta/al/manifiesto.json` para una captura concreta, o `--output ruta/de/salida` para una publicación de trabajo.

## Incidencias

- Una descarga fallida, captura dañada o cambio de formato detiene el proceso y conserva la publicación anterior. El error se escribe en `artifacts/failure.json`.
- Un campo sin segunda fuente o una discrepancia se omiten de la publicación actual y se documentan; no bloquean otras afirmaciones independientes.
- No se interpreta la desaparición de una fila como retirada. Las bajas necesitan dos observaciones explícitas concordantes; los valores anteriores sin corroboración se separan como antiguos.
- Un error de esquema, referencia, matriz o procedencia impide publicar el candidato.
- La publicación usa un directorio candidato, una copia temporal de recuperación y renombrados. Si se interrumpe el intercambio, la siguiente publicación recupera la copia anterior antes de sustituirla. Los lectores locales no deben leer durante ese breve intercambio; GitHub Pages sirve únicamente el commit final.

## Revisar una mecánica o discrepancia

1. Localizar la afirmación y sus observaciones en `pending.json`.
2. Consultar los dos documentos en las revisiones capturadas y comprobar que describen Champions en el contexto pertinente.
3. Para una equivalencia, añadir la afirmación, su valor aprobado, explicación y hashes de las observaciones a `rules/reviewed.json`.
4. Para una regla nueva, definir origen, destino, relación, desencadenante, destinatario, requisitos y parámetros. Vincular las dos observaciones por afirmación, documento, localizador y hash del valor observado.
5. Si hace falta otra representación, ampliar el modelo y los esquemas. Ejecutar pruebas, reconstrucción y validación.

No hay un comando que “apruebe todos los pendientes”. Una revisión no puede reducir la exigencia de dos proveedores. El workflow modifica datos e informes; no modifica adaptadores, reglas revisadas ni código para acomodar automáticamente una mecánica desconocida.

## Pruebas y workflow

`npm test` usa el ejecutor integrado de Node. Comprueba el conjunto completo y casos de conflicto, duplicidad de proveedor, extremos ausentes, reglas invalidadas, altas, bajas, datos antiguos, fallos de fuente/formato y recuperación. Incluye consultas de Lluvia, estados, bayas, megapiedras, formas, precisión, naturalezas y las correcciones documentadas de Champions.

GitHub Actions ejecuta pruebas, actualización, validación y una segunda reconstrucción sin red. Un fallo impide el commit. El token necesita escritura en `main`; el workflow solo añade rutas de datos autorizadas y no crea commits vacíos. Capturas y diagnósticos se suben también cuando hay fallos.

No hay backend, servicio persistente, tarea programada local ni modificación del dominio. La programación solo queda activa cuando el repositorio se aloja en GitHub con Actions habilitado.
