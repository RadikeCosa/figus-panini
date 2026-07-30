# Vistas de colección

## Propósito

`/missing` es una vista de solo lectura para revisar faltantes.

`/duplicates` permite revisar repetidas y realizar correcciones acotadas sobre
esas posiciones sin entrar al álbum completo.

`/missing` ayuda a identificar posiciones faltantes. `/duplicates` ayuda a
identificar copias disponibles para cambio.

`/missing` sigue siendo una vista de consulta sobre la colección ya cargada, pero
también expone una acción para generar la lista completa de faltantes como PDF.

## Carga y error

Ambas rutas cargan mediante `CollectionRepository.load()` desde el componente
cliente compartido `app/_components/collection-views.tsx`.

Estados:

- `loading`: se está abriendo la colección local;
- `ready`: existe una `CollectionState` válida;
- `error`: la carga falló y se muestra `Reintentar`.

Un error de IndexedDB nunca se interpreta como colección vacía.

## Proyecciones

La lógica de agrupación vive en funciones puras:

```text
domain/collection/collection-views.ts
```

Funciones principales:

- `buildMissingCollectionView`;
- `buildDuplicateCollectionView`;
- `listCollectionSectionOptions`;
- `buildAlbumSectionHref`.

Estas funciones reutilizan el dominio existente: faltantes, repetidas, copias,
progreso y orden canónico.

Para la lista imprimible de faltantes existe además:

```text
domain/collection/missing-list-document.ts
```

`buildMissingListDocument` transforma una `CollectionState` y una fecha recibida
en el contenido lógico completo del documento. Es una proyección pura: no usa
React, IndexedDB, APIs del navegador, archivos ni librerías de PDF.

Esta proyección siempre usa la lista completa de faltantes del álbum canónico y
no depende del filtro visible en `/missing`. Las secciones especiales se
representan sin grupo y las selecciones conservan el grupo canónico.

La proyección no genera PDF, no descarga archivos, no imprime y no comparte
contenido.

La generación PDF vive separada en:

```text
infrastructure/export/missing-list-pdf.ts
```

`createMissingListPdf` consume únicamente un `MissingListDocument` ya construido
y devuelve un `Blob` `application/pdf` junto con un nombre de archivo
predecible. No recibe `CollectionState`, no recalcula faltantes, no lee
IndexedDB y no accede a APIs de compartir o descarga.

El PDF representa siempre la lista completa contenida en la proyección, no el
filtro visible de `/missing`.

## Compartir lista

`/missing` muestra el botón `Compartir lista` dentro del resumen global, antes
del filtro de secciones. El botón queda disponible también cuando el álbum está
completo, porque el generador produce un PDF breve para ese caso.

Al activar el botón, la UI:

1. usa la `CollectionState` ya cargada en memoria;
2. construye un `MissingListDocument` con la fecha actual;
3. carga dinámicamente `infrastructure/export/missing-list-pdf.ts`;
4. genera `{ blob, filename }`;
5. crea un `File` PDF;
6. delega en `infrastructure/export/share-or-download-file.ts`.

La carga dinámica evita incluir `pdf-lib` en la carga inicial de la vista. No hay
otra lectura de IndexedDB, no se llama a `CollectionRepository.save()` y la
colección no se modifica.

Mientras se genera o se abre el selector nativo, el botón queda deshabilitado y
muestra `Generando lista…` para evitar ejecuciones simultáneas.

La detección de capacidades usa `navigator.share`,
`navigator.canShare({ files })` y no usa user-agent sniffing. Si el navegador
soporta compartir archivos, se abre el selector nativo con el PDF adjunto,
título y texto. Si la acción se cancela con `AbortError`, la vista vuelve al
estado inicial sin mostrar error ni descargar el archivo.

Si el navegador no soporta compartir archivos, la UI descarga el PDF con una URL
temporal, revoca esa URL y muestra:

```text
El PDF quedó descargado. Podés enviarlo desde WhatsApp como documento.
```

Ante fallas reales de generación o APIs del navegador se muestra un error
reintentable:

```text
No se pudo generar la lista. Intentá nuevamente.
```

No hay impresión directa, almacenamiento del PDF, cacheo de datos de usuario ni
envío automático a WhatsApp.

## Repetidas

La vista distingue dos métricas:

- posiciones con repetidas: cantidad de posiciones con `quantity > 1`;
- copias repetidas: suma de `quantity - 1`.

Ejemplo: `Argentina 7` con 4 copias cuenta como 1 posición con repetidas y 3
copias repetidas.

Cada posición con repetidas ofrece dos acciones distintas:

- `Entregué una`: registra que Pedro entregó una copia repetida durante un
  intercambio. Resta exactamente una copia con `removeCopy`, mantiene como
  mínimo la copia principal y desaparece de la lista si queda en una copia total.
- `Corregir cantidad`: abre un editor compacto para ajustar la cantidad total
  registrada con `setCopies`, incluso a cero cuando la carga previa fue errónea.

La diferencia semántica es intencional: entregar una repetida representa un
intercambio seguro que no elimina la figurita principal; corregir cantidad
representa una rectificación del dato guardado y puede volver la posición
faltante.

Ambas acciones actualizan la colección local, guardan la colección completa con
`CollectionRepository.save()` y recalculan la proyección de repetidas desde el
estado resultante. Mientras un guardado está pendiente, los controles quedan
deshabilitados para evitar escrituras simultáneas.

Si `save()` falla, la vista restaura la colección previa y muestra un error
accesible sin recargar IndexedDB. La acción `Entregué una` muestra una
confirmación breve con `Deshacer`; ese deshacer solo aplica a la última entrega
exitosa visible y guarda nuevamente la colección restaurada.

## Agrupación

Las secciones se agrupan y ordenan según el álbum canónico:

1. `PANINI`;
2. `FWC`;
3. selecciones por grupos `A` a `L`.

No se ordena alfabéticamente.

## Filtros

Cada vista usa un `select` nativo con opción `Todas las secciones` y `optgroup`
por especiales y grupos.

El filtro se aplica sobre los datos ya cargados. Cambiar el filtro no vuelve a
leer IndexedDB ni modifica la colección.

Estados vacíos diferenciados:

- colección vacía con 980 faltantes;
- álbum completo sin faltantes;
- sin repetidas;
- filtro sin resultados.

## Navegación al álbum

Cada sección visible ofrece `Ver en álbum`.

El enlace usa:

```text
/album?section=<sección codificada>
```

`/album` valida la sección recibida contra el dominio. Si el parámetro es
inválido usa `PANINI`.

## Trade-offs

Componente compartido frente a dos implementaciones separadas:
las rutas comparten carga, filtro, estados y layout para evitar duplicación. Las
diferencias quedan en proyecciones y copy.

Filtros locales frente a nuevas consultas:
filtrar en memoria es suficiente para 980 posiciones y evita lecturas
innecesarias de IndexedDB.

Sección frente a posición individual:
la navegación abre la sección en el álbum, no una posición exacta. Es suficiente
para este incremento y evita diseñar deep links de grilla antes de necesitarlos.

## Fuera de alcance

Estas vistas no implementan:

- enlaces a posición individual dentro del álbum.

## Relación con otros documentos

- [UI y flujo de estado](ui-and-state-flow.md)
- [Navegación del álbum](album-navigation.md)
- [PDF de faltantes](missing-list-pdf.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
