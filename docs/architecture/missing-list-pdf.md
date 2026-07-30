# PDF de faltantes

## Propósito

La funcionalidad de lista imprimible genera localmente un PDF para las figuritas
faltantes y lo expone desde `/missing` mediante una acción de compartir o
descargar.

## Frontera

El flujo queda separado en capas:

```text
CollectionState
MissingListDocument
PDF
```

`infrastructure/export/missing-list-pdf.ts` recibe solo un
`MissingListDocument`. No carga IndexedDB, no accede a React, no usa
`navigator.share`, no descarga archivos y no llama a impresión.

La UI de `/missing` construye el `MissingListDocument` desde la colección ya
cargada, importa dinámicamente el generador y recibe `{ blob, filename }`. La
capa de navegador crea el `File` y decide por detección de capacidades si abrir
el selector nativo o descargar como fallback.

## Biblioteca

Se usa `pdf-lib`.

Alternativas consideradas:

- `jsPDF`: API de texto cómoda y salida `Blob`, pero más orientada a comandos de
  alto nivel y con más decisiones propias de layout.
- `pdf-lib`: API explícita, funciona en navegador y Node, no depende del DOM,
  permite A4, fuentes estándar, multipágina y pruebas leyendo el PDF generado.
- HTML/CSS de impresión: útil como complemento futuro para imprimir desde la UI,
  pero no alcanza para producir un archivo PDF compartible desde JavaScript.

Para este caso se eligió `pdf-lib` porque el documento es textual, local,
offline y necesita una salida transportable como `Blob`.

## Layout

El PDF usa A4 real. La primera opción es A4 vertical de `595.28 × 841.89`
puntos. Para listas largas se planifica una grilla compacta de tres columnas con
márgenes laterales cercanos a 10 mm, encabezado de dos líneas, grupos breves y
números explícitos debajo de cada sección.

El orden de lectura es por columna: primera columna de arriba abajo, luego la
segunda y luego la tercera. La distribución puede cortar entre secciones para
balancear la altura, pero no altera el orden canónico del álbum.

Los grupos se imprimen solo cuando hay faltantes en alguna selección del grupo y
quedan unidos al primer bloque de selección correspondiente, evitando encabezados
aislados al final de una columna o página. `PANINI` se imprime como
`PANINI · 00`; `FWC` usa la misma grilla compacta de números que las selecciones.

Cada número faltante se muestra de forma individual. No se comprimen secuencias
como rangos, por lo que una selección completa se ve como dos líneas de números:
`1 2 3 4 5 6 7 8 9 10` y `11 12 13 14 15 16 17 18 19 20`.

Para listas cortas el planificador puede usar una sola columna compacta, evitando
reservar columnas vacías cuando hay pocos faltantes.

La fuente mínima legible definida para el layout es de `7 pt`. Si A4 vertical en
tres columnas no entra, el planificador intenta una variante vertical más
compacta sin bajar de ese mínimo. Si aun así no alcanza, prueba A4 horizontal con
cuatro columnas. El fallback final es multipágina con fuente legible; no se
ocultan números ni se reduce la fuente indefinidamente.

La fuente estándar cubre los caracteres usados por las secciones canónicas en
español, incluidos `México`, `Países Bajos`, `Túnez`, `Bélgica`, `España` y
`Curazao`, sin depender de fuentes remotas.

## Muestras

Las muestras se generan en una carpeta temporal, no versionada, ejecutando:

```text
GENERATE_MISSING_LIST_PDF_SAMPLES=1 npx vitest run infrastructure/export/missing-list-pdf-samples.test.ts
```

Por defecto se escriben en:

```text
/tmp/figus-pani-missing-list-pdf-samples
```

Archivos generados:

- `album-completo.pdf`;
- `pocos-faltantes.pdf`;
- `coleccion-vacia-980-faltantes.pdf`;
- `faltantes-fragmentados.pdf`.

## Pendiente

Queda fuera de alcance la impresión directa y cualquier envío automático a una
aplicación o contacto específico. La impresión se realiza desde el visor o la
aplicación que abra el PDF.
