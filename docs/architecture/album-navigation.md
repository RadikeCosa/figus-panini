# Navegación del álbum

## Propósito

Este documento describe lo implementado para el Incremento 5: `/album` como
pantalla navegable y editable.

La pantalla permite recorrer el álbum canónico, cargar la colección persistida y
ver el estado real de cada posición. También permite sumar o restar copias y
persistir la colección local.

## Jerarquía

La navegación respeta la definición canónica existente:

- secciones especiales: `PANINI` y `FWC`;
- grupos `Grupo A` a `Grupo L`;
- cuatro selecciones por grupo;
- posiciones canónicas de cada sección.

La UI importa la estructura desde `domain/album/canonical-album.ts`. No duplica
nombres, grupos, orden ni rangos.

## Sección inicial y enlaces

La sección inicial es `PANINI`.

Es la primera posición global del álbum y permite mostrar una pantalla cargada
con una grilla mínima antes de que Pedro elija un grupo o selección.

La ruta también acepta `?section=` para abrir una sección desde otras vistas,
por ejemplo:

```text
/album?section=Argentina
/album?section=Corea%20del%20Sur
```

El parámetro se resuelve contra nombres canónicos con las mismas reglas de
normalización del dominio. Si es inválido, la pantalla usa `PANINI` como
fallback. El selector queda sincronizado con la sección inicial resuelta.

## Flujo de carga

`app/album/page.tsx` es Server Component y compone el Client Component
`AlbumBrowser`.

`AlbumBrowser`:

- instancia el `CollectionRepository` del navegador;
- carga la colección una vez al montar;
- muestra `loading`, `ready` o `error`;
- permite reintentar si falla;
- mantiene la sección seleccionada como estado local;
- guarda cambios de cantidad con `repository.save()`.

Cambiar de sección no vuelve a leer IndexedDB. Editar una posición actualiza el
estado local y guarda la colección completa.

## Proyección de estado

La sección seleccionada muestra:

- nombre canónico;
- grupo o categoría especial;
- pegadas;
- total;
- faltantes;
- copias repetidas;
- porcentaje simple.

La grilla muestra una tarjeta por posición de la sección con número visible y
estado textual:

- `Faltante`;
- `Pegada`;
- `N copias` cuando tiene repetidas.

Las métricas usan funciones del dominio de colección como `getSectionProgress`,
`getCopies` y `getDuplicateCopies`.

## Flujo de edición

Cada tarjeta de posición permite:

- agregar una copia;
- quitar una copia;
- ver la cantidad actual;
- impedir resta cuando la cantidad es cero.

La operación usa funciones puras del dominio (`addCopy`, `removeCopy`,
`getCopies` y `getDuplicateCopies`). React no replica reglas de negocio como
negativos, faltantes o repetidas.

El flujo de guardado es:

1. guardar referencia a la colección anterior;
2. aplicar la operación pura al estado local;
3. mostrar `Guardando cambios...`;
4. persistir la colección completa con `repository.save()`;
5. mostrar `Cambios guardados.` si termina bien;
6. si falla, restaurar la colección anterior y mostrar un error accesible.

Mientras `save()` está pendiente, los botones de cantidad quedan deshabilitados.
Esto serializa los cambios de forma simple y evita sobrescribir actualizaciones
recientes con guardados anteriores.

## Estrategia responsive

La navegación usa un `select` nativo con `optgroup`.

En mobile mantiene una sola sección visible y una grilla compacta sin overflow.
En pantallas más anchas aumenta la cantidad de columnas, pero no introduce una
experiencia distinta.

## Trade-offs

Selector compacto frente a lista completa:
el `select` evita 50 controles grandes apilados y mantiene teclado/accesibilidad
nativa. El costo es que no se ven todas las secciones al mismo tiempo.

Una sección visible frente a renderizar las 980 posiciones:
renderizar solo la sección activa mantiene la lectura rápida y evita una página
enorme en teléfono. El costo es que comparar secciones requiere cambiar el
selector.

Navegación local frente a URL persistida:
la sección seleccionada vive en estado local después de la carga inicial. El
query string solo define la sección de entrada, suficiente para saltar desde
faltantes o repetidas sin acoplar la UI a una posición individual.

Grilla visual frente a tabla:
la grilla se parece más al uso junto al álbum físico y permite lectura rápida de
estado. El costo es que una tabla sería más densa para revisión masiva.

Edición contextual frente a entrada rápida:
la escritura desde `/album` sirve para corregir cantidades sin perder contexto.
La entrada rápida vive en `/quick-entry` como flujo separado para sumar
figuritas de a una con menos pasos.

Bloqueo breve frente a cola compleja:
la UI deshabilita los controles mientras guarda. El costo es que taps muy
rápidos no se acumulan durante unos instantes; el beneficio es rollback simple y
coherencia entre UI e IndexedDB.

## Fuera de alcance

Todavía no existe en `/album`:

- nombres de jugadores;
- imágenes, escudos o metadatos editoriales;
- backup, restauración o PWA.
