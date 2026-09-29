# Operación y actualización

Usar Node.js 24 y `npm ci`. `npm run data:update` fija el commit de champout, descarga sus tablas/textos, normaliza, aplica las interpretaciones revisadas, valida el conjunto completo y publica. Hay caché por huella, tres intentos, tiempo límite y tres conexiones simultáneas. También captura los complementos autorizados de OP.GG, Showdown y Pokémon oficial; Showdown se fija a un commit por ejecución.

## Reconstrucción sin red

Se necesitan la revisión del código, las reglas, `sources/snapshot.json` y los objetos de `.cache/objects/`:

```sh
npm run data:rebuild
npm run data:validate
npm test
npm run site:build
npm run test:browser
```

En un clon nuevo, restaurar las capturas del artefacto `champions-evidence-<run_id>` o ejecutar una descarga nueva. `--snapshot ruta/al/manifiesto.json` selecciona capturas concretas y `--output ruta/de/salida` una publicación de trabajo. Se requieren capturas `champout/` y `supplement/`. Los manifiestos históricos sin complementos no permiten reconstruir esta publicación; debe obtenerse una captura nueva. No se reinterpretan datos externos como evidencia de champout.

Las huellas se comprueban antes de interpretar. Mismas capturas, código, reglas y publicación anterior producen el mismo contenido. Una ejecución sin cambios no modifica los archivos ni su informe de cambios. La publicación anterior es una entrada para calcular diferencias, no para rellenar campos ausentes.

## Incidencias y revisiones

- Fallos de descarga, capturas dañadas o estructura incompatible conservan la publicación anterior y dejan `artifacts/failure.json`.
- Un dato ausente o una interpretación invalidada se omite del candidato y se documenta sin bloquear datos independientes.
- Una baja requiere una bandera negativa explícita de champout. Una ausencia aislada no demuestra retirada.
- Esquemas, referencias, IDs duplicados, hashes y procedencia se validan antes del intercambio de directorios.
- Las reglas nuevas se añaden a `rules/champout-reviewed.json`, con documento, localizador, hash observado y significado revisado. Un cambio de texto invalida la regla hasta su revisión. No se aprueban equivalencias mediante similitud textual.

La política mantiene champout como origen prioritario. `rules/supplemental-scope.json` fija los 147 huecos autorizados; `rules/supplemental-reviewed.json` vincula las interpretaciones de Showdown a fragmentos y huellas. Si estos cambian, la regla vuelve a pendiente. El anuncio oficial se compara con `snapshot.asOf`: un reglamento caducado no se publica como vigente. Ampliar el alcance o admitir un reglamento distinto requiere actualizar estas reglas. Los datos desconocidos no se convierten en neutros, listas vacías o ceros.

## GitHub Actions

El workflow semanal descarga champout y los complementos, valida y prueba el nuevo conjunto, verifica su reconstrucción sin red y hace commit solo de `data/` y `sources/snapshot.json`. No modifica código ni reglas y no crea commits vacíos. Guarda capturas e informes como artefactos y llama al workflow reutilizable de la web.

El repositorio público [RASK18/ChampionsDB](https://github.com/RASK18/ChampionsDB) ya contiene el workflow en `main`, con permiso `contents: write` solicitado para la actualización semanal. Esta configuración no modifica el dominio ni inicia una tarea local permanente.
