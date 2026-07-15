# Formato persistido de colección local

## Estado

Aceptada.

## Contexto

La colección de Pedro empieza a persistirse en IndexedDB. El dominio ya define
la colección como un estado disperso de copias por posición canónica, y la
persistencia debe conservar esa separación sin duplicar las 980 posiciones del
álbum.

También hace falta distinguir cambios del esquema físico de IndexedDB de cambios
del formato lógico de la colección guardada.

## Decisión

La base IndexedDB usa una versión de esquema propia, inicialmente `1`.

El registro persistido de la colección usa un formato lógico versionado,
inicialmente:

```ts
{
  formatVersion: 1,
  copiesByPosition: Record<string, number>
}
```

`copiesByPosition` almacena solo el estado disperso de copias. No persiste las
980 posiciones del álbum ni metadatos de jugadores, imágenes, promocionales o
definición canónica duplicada.

Al cargar, el dato persistido se trata como entrada externa: se valida versión,
estructura y contenido, y luego se normaliza con las reglas del dominio.

## Alternativas consideradas

- Persistir las 980 posiciones completas.
- Persistir directamente el objeto interno sin `formatVersion`.
- Usar una librería de IndexedDB o schemas para este primer contrato.
- Usar API nativa de IndexedDB con un formato mínimo versionado.

## Consecuencias

- Una colección inexistente se interpreta como colección vacía válida.
- Un dato corrupto, una versión no soportada, claves desconocidas o cantidades
  inválidas producen un error explícito.
- No se reemplazan silenciosamente datos inválidos por una colección vacía.
- Futuras migraciones podrán distinguir entre cambios de esquema IndexedDB y
  cambios de formato lógico de colección.
