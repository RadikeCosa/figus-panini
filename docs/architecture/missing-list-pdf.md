# PDF de faltantes

## Propósito

La funcionalidad de lista imprimible genera localmente un PDF con la lista
completa de figuritas faltantes. El archivo queda disponible desde `/missing`
para compartirlo o descargarlo, y puede imprimirse luego desde el visor o la
aplicación que abra el PDF.

El procesamiento usa la colección local ya cargada. No requiere backend, enlace
público, red ni servicio externo para calcular faltantes o construir el archivo.

## Flujo de datos

El flujo queda separado en capas:

```text
CollectionState ya cargada
        ↓
buildMissingListDocument
        ↓
MissingListDocument
        ↓
createMissingListPdf
        ↓
Blob + filename
        ↓
compartir o descargar desde la UI
```

`domain/collection/missing-list-document.ts` expone
`buildMissingListDocument(collection, generatedAt)`. Es una proyección pura: no
conoce PDF, React, IndexedDB, `File`, Web Share API ni descarga.

`infrastructure/export/missing-list-pdf.ts` expone
`createMissingListPdf(document)`. Recibe solo un `MissingListDocument` y devuelve
`{ blob, filename }`, donde el `Blob` es `application/pdf` y el nombre sigue el
formato `figuritas-faltantes-YYYY-MM-DD.pdf`. No carga IndexedDB, no accede a
React, no usa `navigator.share`, no descarga archivos y no llama a impresión.

`infrastructure/export/share-or-download-file.ts` recibe un `File` ya creado y
decide si abrir el selector nativo o descargar. No conoce reglas de faltantes ni
recalcula la colección.

La UI de `/missing` coordina las piezas con la `CollectionState` que ya tiene en
memoria: construye el `MissingListDocument`, importa dinámicamente el generador,
crea el `File` y delega el compartir o descargar.

## Contenido lógico

`MissingListDocument` contiene:

- fecha de generación;
- total del álbum;
- figuritas únicas poseídas;
- cantidad total de faltantes;
- secciones con faltantes en orden canónico;
- posiciones faltantes por sección;
- grupo canónico para secciones de selecciones.

Las secciones sin faltantes se omiten. Cuando el álbum está completo,
`sections` queda vacío y el PDF generado usa un mensaje breve de álbum completo.

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
márgenes laterales de `28 pt`, margen superior e inferior de `24 pt` y separación
de `10 pt` entre columnas. El encabezado compacto usa dos líneas:

```text
FIGURITAS FALTANTES · Álbum de Pedro
980 faltantes de 980 · Actualizada 30/07/2026, 15:20
```

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

La tipografía es Helvetica estándar en blanco y negro. Los tamaños de la
configuración A4 vertical principal son:

- título: `11 pt`;
- resumen: `8 pt`;
- grupo: `8 pt` en negrita;
- sección: `8.2 pt` en negrita;
- números: `7.8 pt`.

La fuente mínima legible definida para el layout es de `7 pt`. Si A4 vertical en
tres columnas no entra, el planificador intenta una variante vertical más
compacta con márgenes de `24 pt`, separación de `8 pt` entre columnas y números
de `7 pt`. Si aun así no alcanza, prueba A4 horizontal con cuatro columnas. El
fallback final es multipágina con fuente legible; no se ocultan números ni se
reduce la fuente indefinidamente.

La fuente estándar cubre los caracteres usados por las secciones canónicas en
español, incluidos `México`, `Países Bajos`, `Túnez`, `Bélgica`, `España` y
`Curazao`, sin depender de fuentes remotas.

La prioridad es una sola hoja cuando siga siendo legible. Si el contenido real no
entra, se prioriza legibilidad y se generan más páginas.

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

- `album-completo.pdf`: 1 página, A4 vertical, mensaje breve de álbum completo;
- `pocos-faltantes.pdf`: 1 página, A4 vertical, lista parcial compacta;
- `coleccion-vacia-980-faltantes.pdf`: 1 página, A4 vertical, 980 faltantes,
  `PANINI`, `FWC`, 48 selecciones y 12 grupos;
- `faltantes-fragmentados.pdf`: 1 página, A4 vertical, 488 faltantes alternados
  en muchas secciones.

La revisión local usó `pdfinfo` para confirmar tamaño A4, orientación y cantidad
de páginas; `pdftotext -layout` para revisar orden, acentos y números
individuales; y renderizado a PNG con `pdftoppm` para revisar márgenes,
separación y ausencia de superposición. La simulación visual revisada fue sobre
el PDF renderizado a escala fija; no queda registrada una prueba en impresora
física ni en dispositivos móviles reales.

## Compartir y descargar

El adaptador detecta capacidades, no navegador por user-agent:

1. verifica `navigator.share`;
2. verifica `navigator.canShare`;
3. llama a `navigator.canShare({ files: [file] })`.

Cuando el navegador admite compartir archivos, llama a `navigator.share` con el
PDF adjunto, título y texto. Si `navigator.share` rechaza con `AbortError`, la
acción se interpreta como cancelación: no se muestra error y no se descarga el
archivo.

Cuando compartir archivos no está disponible, se crea una URL temporal para el
`File`, se dispara la descarga local y la URL se revoca en el bloque `finally`.
La UI muestra un mensaje de descarga, pero no confirma que el archivo haya sido
enviado por otra aplicación.

No existe integración directa con un número de WhatsApp, contactos ni envío
automático.

## Carga dinámica y offline

`/missing` importa dinámicamente `infrastructure/export/missing-list-pdf.ts` al
tocar `Compartir lista`. Así `pdf-lib` no forma parte de la carga inicial de la
vista. En el build actual, el chunk cliente que contiene el generador y
`pdf-lib` queda como asset estático de Next.js de aproximadamente `428 KB` sin
comprimir.

El service worker cachea assets de `/_next/static/` en runtime después de la
primera solicitud. Por eso, la generación del PDF sin conexión queda disponible
si `/missing` ya fue cargada y el chunk dinámico del generador fue solicitado al
menos una vez con conexión. Si el primer intento de `Compartir lista` ocurre sin
conexión antes de haber descargado ese chunk, la disponibilidad no está
garantizada.

La colección se lee desde IndexedDB por el flujo normal de `/missing`; el
generador no lee IndexedDB. El PDF generado no se guarda en Cache Storage ni en
IndexedDB. Compartir o descargar usa APIs locales del navegador.

## Trade-offs

Todos los números frente a rangos:
se eligió mostrar cada número individual para que el documento sea directo de
marcar y revisar, aunque use más espacio.

Una página frente a legibilidad:
el caso de 980 faltantes entra en una hoja A4 vertical con la configuración
actual. Si contenido futuro no entra, el layout prefiere más páginas antes que
fuente ilegible.

A4 vertical frente a horizontal:
A4 vertical resuelve las muestras actuales y es más natural para impresión. A4
horizontal queda como alternativa automática solo si vertical no alcanza.

Carga diferida frente a disponibilidad inmediata offline:
la carga dinámica evita agrandar la carga inicial de `/missing`. El costo es que
el primer uso offline del PDF requiere que el chunk ya se haya solicitado antes.

PDF real frente a HTML de impresión:
el PDF es transportable como archivo y funciona con Web Share API. HTML de
impresión podría servir como complemento futuro, pero no reemplaza el archivo
compartible.

`pdf-lib` frente a alternativas:
se eligió por salida `Blob`, soporte en navegador y Node, control explícito de
A4 y pruebas leyendo el PDF generado.

## Fuera de alcance

Queda fuera de alcance:

- impresión directa mediante un botón de la app;
- edición manual del documento;
- personalización de plantilla;
- imágenes o nombres de jugadores;
- listas de repetidas;
- almacenamiento de PDFs;
- backend;
- enlaces públicos;
- acceso a contactos;
- envío automático a una aplicación o contacto específico.
