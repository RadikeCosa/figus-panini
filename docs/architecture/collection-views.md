# Vistas de colección

## Propósito

`/missing` es una vista de solo lectura para revisar faltantes.

`/duplicates` permite revisar repetidas y realizar correcciones acotadas sobre
esas posiciones sin entrar al álbum completo.

`/missing` ayuda a identificar posiciones faltantes. `/duplicates` ayuda a
identificar copias disponibles para cambio.

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

- copiado de listas;
- enlaces a posición individual dentro del álbum.

## Relación con otros documentos

- [UI y flujo de estado](ui-and-state-flow.md)
- [Navegación del álbum](album-navigation.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
