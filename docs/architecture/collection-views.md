# Vistas de colección

## Propósito

`/missing` y `/duplicates` son vistas de solo lectura para revisar la colección
persistida sin modificar cantidades.

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

- edición de cantidades;
- copiado de listas;
- exportación o importación;
- backup o restauración;
- PWA;
- enlaces a posición individual dentro del álbum.

## Relación con otros documentos

- [UI y flujo de estado](ui-and-state-flow.md)
- [Navegación del álbum](album-navigation.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
