# Definición del producto

## Contexto

Álbum de Pedro es una app local para gestionar la colección física de figuritas del Mundial 2026. El uso real ocurre al lado del álbum, sobres o paquetes abiertos, con prioridad en rapidez, claridad y control sobre los datos.

## Usuario principal

Pedro es la persona que carga, revisa y corrige su colección. La experiencia debe ayudarle a saber qué tiene, qué le falta y qué puede cambiar, con pocos pasos y sin depender de infraestructura remota.

## Problema que resuelve

La colección física es difícil de llevar mentalmente cuando hay muchas figuritas, repetidas y faltantes. La app ordena esa información, muestra progreso y permite registrar cambios sin perder contexto.

## Propuesta de valor

La app ofrece una forma simple de seguir la colección desde el celular, con foco en uso mobile-first, persistencia local y una representación clara del estado real de la colección.

## Objetivos del producto

- Registrar y consultar la colección de forma confiable.
- Mostrar progreso, faltantes y repetidas sin ambigüedades.
- Hacer fácil corregir cantidades y restaurar datos.
- Mantener la información disponible localmente.
- Evitar complejidad innecesaria.

## Conceptos principales

### Definición del álbum

La definición del álbum es el catálogo canónico de las 980 figuritas válidas del
MVP. Incluye únicamente las posiciones del álbum físico estándar. Las figuritas
promocionales, incluidas las de Coca-Cola, quedan fuera de la colección principal
y no participan del progreso, faltantes, repetidas, búsqueda ni backup.

El MVP adopta una identidad mínima de posiciones: cada posición se identifica
conceptualmente por un nombre canónico de sección y un número de posición dentro
de esa sección. No se mantendrán por ahora campos separados como `sectionId`,
`slug` y `displayName`.

La estructura canónica es: una sección `PANINI` con la posición `00`, una
sección `FWC` con posiciones `1` a `19`, y 48 secciones de selecciones con
posiciones `1` a `20`. Total: `1 + 19 + 48 x 20 = 980`.

El nombre canónico de cada sección debe permanecer estable una vez que existan
colecciones guardadas; cualquier cambio futuro de nombre debe tratarse como una
migración explícita. El orden del álbum es un dato de presentación, no parte de
la identidad.

No es necesario disponer de nombres de jugadores, tipo de figurita, escudos,
fotos, imágenes, rareza ni otros metadatos editoriales para avanzar con el MVP.
La lista y el orden de las 48 selecciones fueron confirmados por el responsable
del proyecto a partir del orden de grupos del álbum.

### Colección del usuario

La colección del usuario es el conjunto de figuritas que Pedro fue registrando, con una cantidad asociada a cada código válido.

### Copia

Una copia es cada unidad adicional de una figurita por encima de la primera poseída. Las copias sirven para detectar repetidas y preparar intercambios.

### Figurita faltante

Es una figurita válida del álbum cuya cantidad registrada es cero o no existe en la colección.

### Figurita repetida

Es una figurita válida cuya cantidad registrada es mayor que uno. La cantidad extra cuenta como repetida disponible para cambio.

## Experiencia esperada

La app debe dejar ver el estado de la colección con rapidez, permitir ajustes sin fricción y conservar la confianza en los datos guardados.

## Principios de producto

- Local-first por defecto.
- Mobile-first y orientada a uso táctil.
- Clara antes que decorativa.
- Datos confiables antes que atajos.
- Cambios pequeños y reversibles.

## No objetivos

- No es una red social.
- No es una plataforma con cuentas o sincronización remota.
- No es un sistema general de gestión de colecciones.
- No incluye figuritas promocionales como parte de la colección principal.
- No requiere nombres de jugadores ni metadatos editoriales individuales para avanzar con el MVP.

## Relación con otros documentos

- [Alcance del MVP](../product/mvp-scope.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Decisiones](../decisions/README.md)
