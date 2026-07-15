# Identidad mínima de posiciones

## Estado

Aceptada.

## Contexto

El MVP necesita avanzar con una definición canónica suficiente del álbum sin
esperar nombres individuales de jugadores ni metadatos editoriales completos.
Antes de implementar, se simplifica esta decisión para evitar campos de identidad
que todavía no aportan valor al alcance real del proyecto.

También está aceptado que el universo canónico del MVP contiene 980 posiciones
del álbum físico estándar y excluye figuritas promocionales.

## Decisión

El MVP modela:

- una sección `PANINI` con la posición `00`;
- una sección `FWC` con posiciones `1` a `19`;
- 48 secciones correspondientes a selecciones, con posiciones `1` a `20`;
- total: `1 + 19 + 48 x 20 = 980`.

La identidad de una posición se construye conceptualmente con:

- el nombre canónico de sección;
- el número de posición dentro de esa sección.

Ejemplos conceptuales:

- `Argentina` + `1`;
- `Corea del Sur` + `20`;
- `FWC` + `1`;
- `PANINI` + `00`.

No se define todavía el formato técnico de serialización ni nombres de tipos
TypeScript.

No se mantendrán por ahora campos separados como `sectionId`, `slug` y
`displayName`.

La lista y el orden de las 48 selecciones quedaron confirmados por el responsable
del proyecto a partir del orden de grupos del álbum.

## Alternativas consideradas

- Esperar nombres individuales de jugadores antes de avanzar.
- Mantener identificador interno de selección separado del nombre canónico.
- Usar códigos visibles finales del álbum como único requisito para iniciar el
  dominio.
- Adoptar una identidad mínima por nombre canónico de sección y número de
  posición.

## Consecuencias

- El proyecto puede avanzar sin nombres de jugadores, tipo de figurita, escudo,
  foto del equipo, imágenes, rareza ni metadatos editoriales adicionales.
- Esos datos pueden agregarse después sin cambiar la identidad de las posiciones
  ni la colección guardada.
- La validación del dataset debe producir exactamente 980 posiciones únicas:
  `PANINI-00`, `FWC-1..FWC-19` y 48 secciones de selecciones con posiciones
  `1..20`.
- El nombre canónico de la sección debe permanecer estable una vez que existan
  colecciones guardadas.
- Cualquier cambio futuro de nombre debe tratarse como una migración explícita.
- El orden del álbum es un dato de presentación, no parte de la identidad.

## Datos todavía pendientes

No quedan datos pendientes para cerrar el Incremento 1 del MVP. Una auditoría
posterior puede contrastar el dataset contra álbum físico o checklist oficial sin
cambiar la identidad mínima adoptada.
