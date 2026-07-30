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

El PDF usa A4 vertical, una columna, márgenes fijos, Helvetica estándar y
paginado automático. Los grupos se muestran una vez por bloque de selecciones y
`PANINI`/`FWC` no llevan grupo.

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
- `coleccion-vacia-980-faltantes.pdf`.

## Pendiente

Queda fuera de alcance la impresión directa y cualquier envío automático a una
aplicación o contacto específico. La impresión se realiza desde el visor o la
aplicación que abra el PDF.
