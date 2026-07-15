# Investigación de fuente del álbum

## Objetivo

Documentar cómo obtener una definición mínima, verificable y reproducible de
las 980 posiciones del álbum Panini FIFA World Cup 2026, sin inventar la lista
de selecciones, nombres canónicos de sección ni orden.

Este documento cubre solo el Incremento 1 del
[roadmap](../planning/implementation-roadmap.md). No define todavía dataset,
tipos, scripts, persistencia ni superficies de la aplicación. El contexto de
producto vigente está en la [definición del producto](../product/product-definition.md)
y el [alcance del MVP](../product/mvp-scope.md).

## Estado actual

El incremento está completado para el alcance del MVP.

La decisión vigente del proyecto es que la definición canónica del MVP incluye
únicamente las 980 figuritas que ocupan espacios en el álbum físico estándar.
Las figuritas promocionales, incluidas las de Coca-Cola, quedan fuera del MVP y
no participan del progreso, faltantes, repetidas, búsqueda ni backup.

La lista y el orden de las 48 selecciones fueron confirmados por el responsable
del proyecto a partir del orden de grupos del álbum. Esa lista es la fuente
canónica adoptada por el proyecto para el MVP.

El MVP modela una sección `PANINI` con posición `00`, una sección `FWC` con
posiciones `1..19`, y 48 secciones de selecciones con posiciones `1..20`.

## Datos mínimos necesarios

### Identidad estable obligatoria

- Nombre canónico de sección.
- Número de posición dentro de la sección.
- Pertenencia a la colección física exacta que usará Pedro.

No se mantienen por ahora campos separados como `sectionId`, `slug` y
`displayName`. Una vez que existan colecciones guardadas, el nombre canónico de
sección debe permanecer estable; cualquier cambio futuro de nombre requiere una
migración explícita.

### Datos necesarios para navegación y búsqueda

- Nombre visible de la sección.
- Tipo de sección cuando ayude a agrupar: `PANINI`, `FWC` o selección.
- Posición dentro de la sección.
- Orden de presentación para recorrer y copiar listas.

### Datos opcionales

- Nombre de jugador, escudo, estadio, mascota, imagen especial u otra
  descripción editorial.
- Tipo de figurita especial o metalizada, si ocupa una posición del álbum
  estándar y aparece explícitamente en la fuente.
- Página del álbum o referencia física para facilitar auditoría manual.
- Idioma o edición regional de origen si cambia la rotulación visible.

### Datos que no necesitamos almacenar

- Imágenes, retratos o assets protegidos.
- Estadísticas deportivas.
- Precios, rareza comercial o valor de reventa.
- Probabilidades de sobres.
- Datos de partidos, fixture o resultados del Mundial.
- Información biográfica que no ayude a identificar la figurita.
- Figuritas promocionales, incluidas las de Coca-Cola.
- Nombres individuales de jugadores.
- Tipo de figurita, escudo, foto del equipo, imágenes, rareza o metadatos
  editoriales adicionales.

## Fuentes candidatas

### 1. Álbum físico oficial de Pedro

- Tipo de fuente: material físico primario.
- Ubicación o referencia: el álbum Panini FIFA World Cup 2026 que Pedro usará
  para coleccionar.
- Datos que aporta: secciones, orden de páginas, espacios visibles, códigos,
  nombres impresos y relación entre sección y posición.
- Cobertura aparente: debería cubrir la totalidad de los espacios del álbum
  físico; debe contarse manualmente.
- Confiabilidad: alta para la edición física concreta de Pedro.
- Limitaciones: requiere acceso físico, tiempo de transcripción y revisión;
  puede no explicar variantes regionales o promocionales fuera del álbum
  estándar.
- Extracción o transcripción: transcripción manual asistida por fotos propias,
  planilla de control y doble revisión.
- Riesgos: errores humanos de lectura, páginas omitidas, confusión entre código
  de figurita y número de espacio, restricciones de uso sobre imágenes o texto
  editorial.

### 2. Checklist oficial impreso o folleto de Panini

- Tipo de fuente: material físico primario.
- Ubicación o referencia: checklist incluido en el álbum, folleto oficial,
  contraportada, hoja de control o material de reposición.
- Datos que aporta: listado de secciones, posiciones, agrupaciones y, si existe,
  orden de colección.
- Cobertura aparente: potencialmente completa, pero debe verificarse contra el
  álbum físico.
- Confiabilidad: alta si el checklist pertenece a la misma edición.
- Limitaciones: puede no incluir nombres completos o puede usar abreviaturas.
- Extracción o transcripción: escaneo o foto propia, transcripción manual y
  comparación contra espacios del álbum.
- Riesgos: edición regional distinta, errores de impresión, checklist incompleto
  o mezclado con contenido promocional fuera del MVP.

### 3. Página oficial de producto de Panini

- Tipo de fuente: fuente oficial pública.
- Ubicación o referencia: sitios oficiales de Panini por país o tienda oficial.
- Datos que aporta: nombre comercial, edición, cantidad total declarada,
  cantidad de páginas, sobres por paquete, posibles especiales o promociones.
- Cobertura aparente: no parece cubrir el checklist completo en páginas públicas
  encontradas durante esta investigación.
- Confiabilidad: alta para datos generales del producto; insuficiente para
  códigos y orden si no publica checklist.
- Limitaciones: puede variar por país, agotarse, cambiar o retirar páginas; la
  página de producto no necesariamente enumera cada figurita.
- Extracción o transcripción: captura de URL, fecha de consulta y campos
  visibles; no usar scraping si los términos del sitio lo restringen.
- Riesgos: cambios comerciales, datos resumidos, falta de trazabilidad por
  figurita.

### 4. App o álbum digital oficial de Panini

- Tipo de fuente: fuente oficial digital.
- Ubicación o referencia: aplicación o sitio de colecciones digitales de Panini,
  si existe para la edición 2026.
- Datos que aporta: secciones, nombres visibles, imágenes, progreso y
  posiblemente orden.
- Cobertura aparente: no confirmada para la edición física; fuentes periodísticas
  mencionan una colección digital disponible, pero no aportan checklist completo.
- Confiabilidad: alta si corresponde a la misma colección física; media si es
  una colección paralela con diferencias.
- Limitaciones: puede requerir cuenta, estar protegida por términos de uso,
  exponer datos mediante UI y no como listado exportable.
- Extracción o transcripción: revisión manual desde UI, solo registrando
  identificadores mínimos necesarios y trazabilidad, sin copiar imágenes.
- Riesgos: diferencias entre digital y físico, restricciones de automatización,
  cambios de contenido.

### 5. Comunicados o material de prensa oficial

- Tipo de fuente: fuente oficial o semioficial.
- Ubicación o referencia: notas de lanzamiento de Panini, FIFA o partners como
  Coca-Cola.
- Datos que aporta: cantidad total, cantidad de especiales, promociones y
  contexto de lanzamiento.
- Cobertura aparente: parcial.
- Confiabilidad: alta para datos generales; insuficiente para dataset completo.
- Limitaciones: rara vez incluye todos los códigos o el orden.
- Extracción o transcripción: registrar URL, fecha y afirmaciones relevantes.
- Riesgos: lenguaje promocional, datos incompletos, cambios por región.

### 6. Cobertura periodística reciente

- Tipo de fuente: fuente secundaria contrastable.
- Ubicación o referencia:
  - Associated Press, "World Cup sticker frenzy..." (27 de junio de 2026):
    https://apnews.com/article/40837a6ed846f3c923db59916f62b4ad
  - FourFourTwo, "World Cup 2026 sticker collection from Panini..." (30 de abril
    de 2026): https://www.fourfourtwo.com/products-kit/world-cup-2026-sticker-collection-from-panini-everything-you-need-to-know-as-album-on-sale-today
  - El Pais Chile, "Furor en Chile por las laminas del Mundial 2026..." (28 de
    mayo de 2026): https://elpais.com/chile/2026-05-28/furor-en-chile-por-las-laminas-del-mundial-2026-donde-se-hara-la-gran-cambiaton-para-llenar-el-album.html
  - Houston Chronicle, "One of the most in-demand items in Houston?..." (5 de
    junio de 2026): https://www.houstonchronicle.com/world-cup/article/panini-sticker-album-22268322.php
- Datos que aporta: cantidad total reportada de 980 figuritas estándar, 48
  selecciones, 112 páginas, 68 especiales en algunos casos, existencia de
  contenido promocional Coca-Cola fuera de la colección estándar y disponibilidad
  regional.
- Cobertura aparente: parcial; no publica listado completo de códigos.
- Confiabilidad: media para corroborar datos generales cuando varias fuentes
  coinciden; baja para definir el dataset canónico.
- Limitaciones: no reemplaza al álbum ni a Panini; puede simplificar, omitir
  variantes o mezclar mercados.
- Extracción o transcripción: solo usar como evidencia auxiliar de discrepancias
  y contexto.
- Riesgos: errores periodísticos, paywalls, diferencias regionales, falta de
  códigos.

### 7. Listas de coleccionistas, planillas compartidas o marketplaces

- Tipo de fuente: fuente secundaria no oficial.
- Ubicación o referencia: planillas públicas, publicaciones de intercambio,
  listados de venta o comunidades de coleccionistas.
- Datos que aporta: secciones, posiciones, códigos visibles, faltantes
  frecuentes, nombres, fotos parciales y posibles checklists reconstruidos.
- Cobertura aparente: variable.
- Confiabilidad: baja como fuente canónica; útil solo para detectar discrepancias
  o revisar muestras.
- Limitaciones: no hay garantía de edición, completitud ni orden.
- Extracción o transcripción: comparar contra fuente primaria; no copiar sin
  verificar.
- Riesgos: errores acumulados, falsificaciones, ediciones regionales mezcladas,
  contenido protegido o no autorizado.

## Comparación de fuentes

| Fuente | Cobertura | Confiabilidad | Sirve como canónica | Uso recomendado |
| --- | --- | --- | --- | --- |
| Álbum físico oficial de Pedro | Alta si se revisa completo | Alta | Sí, si se audita completo | Fuente base para secciones, posiciones y orden |
| Checklist oficial impreso | Alta si pertenece a la misma edición | Alta | Sí, contrastado con el álbum | Fuente base para secciones, posiciones y control de completitud |
| Página oficial de Panini | Parcial | Alta para datos generales | No sola | Confirmar edición, total y promociones |
| App o álbum digital oficial | No confirmada | Alta o media según equivalencia | No sola | Apoyo para nombres visibles y orden si coincide con físico |
| Comunicados oficiales | Parcial | Alta para declaraciones | No | Contexto y validación de totales generales |
| Periodismo reciente | Parcial | Media | No | Contexto sobre total estándar y contenido promocional |
| Listas de coleccionistas | Variable | Baja | No | Detección auxiliar de errores |

## Fuente recomendada

La evidencia disponible confirma el alcance cuantitativo y el modelo mínimo del
MVP: `PANINI-00`, `FWC-1..FWC-19` y 48 secciones de selecciones con posiciones
`1..20`, sin figuritas promocionales. La lista y el orden de selecciones
confirmados por el responsable del proyecto son la fuente canónica adoptada para
este incremento.

La fuente recomendada para futuras auditorías es una combinación controlada:

1. álbum físico oficial de Pedro;
2. checklist oficial impreso o material de control de Panini de la misma edición;
3. página oficial de producto de Panini solo para confirmar edición y datos
   generales;
4. fuentes secundarias únicamente para detectar discrepancias, nunca para cerrar
   el dataset.

Motivo: el dataset mínimo ya cierra el MVP, pero el material físico sigue siendo
la referencia preferida para resolver discrepancias futuras.

## Procedimiento de obtención

1. Usar la lista de 48 selecciones confirmada por el responsable del proyecto en
   el orden de grupos del álbum.
2. Registrar la posición `00` de la sección `PANINI`.
3. Registrar posiciones `1..19` de la sección `FWC`.
4. Registrar posiciones `1..20` para cada selección confirmada.
5. Marcar todo contenido promocional, incluidas figuritas Coca-Cola, como fuera
   del dataset del MVP.
6. Validar que la expansión produzca exactamente 980 posiciones únicas.
7. Resolver cualquier discrepancia futura con una revisión explícita antes de
   cambiar el nombre canónico de sección o la posición.

No se recomienda extracción automática como primer paso. Puede usarse OCR o
planillas solo como apoyo, pero el resultado debe revisarse manualmente contra
el álbum físico y el checklist.

## Procedimiento de validación

Antes de completar el Incremento 1, la definición debe poder validarse con
estos controles:

- Total exacto de 980 registros estándar.
- Una posición `PANINI-00`.
- 19 posiciones `FWC-1..FWC-19`.
- 48 secciones de selecciones.
- 20 posiciones por selección.
- Ausencia de nombres canónicos de sección duplicados.
- Ausencia de pares duplicados de sección y posición.
- Ausencia de identificadores vacíos o normalizados a valores ambiguos.
- Secciones completas según conteo físico.
- Orden global estable y reproducible.
- Orden por sección estable y reproducible.
- Detección de faltantes contra el conteo esperado por sección.
- Detección de registros sobrantes que no correspondan a un espacio físico.
- Validación de que cada figurita pertenece a una sección existente.
- Validación de que los rangos o posiciones de cada sección coinciden con la
  fuente.
- Validación de que no existen registros promocionales dentro del dataset
  canónico.
- Revisión manual de una muestra representativa: primera, última y al menos dos
  posiciones intermedias por sección; todas las secciones especiales completas.
- Trazabilidad visible desde cada registro hacia fuente, página o posición
  física.
- Registro separado de correcciones futuras, preservando el código canónico
  cuando ya exista colección del usuario asociada.

Si se detecta un error futuro después de que Pedro ya tenga colección cargada,
la corrección debe clasificarse antes de aplicarse:

- Error descriptivo: puede corregirse sin tocar cantidades.
- Error de orden: puede corregirse si el nombre canónico de sección y la
  posición no cambian.
- Error de nombre canónico de sección o posición: requiere migración explícita y
  trazable para no perder la colección del usuario.
- Figurita agregada o eliminada: requiere decisión de producto antes de cambiar
  el total esperado de la colección estándar.

## Riesgos

- La colección puede tener diferencias regionales entre Argentina, Chile,
  Estados Unidos, Reino Unido u otros mercados.
- Promociones como Coca-Cola pueden mezclarse en material comercial o de prensa;
  no deben incorporarse al dataset canónico del MVP.
- Fuentes secundarias pueden repetir el mismo dato incorrecto.
- Transcribir nombres de jugadores no es necesario para el MVP y puede demorar
  innecesariamente el avance.
- Copiar imágenes o texto editorial extenso puede introducir restricciones de
  uso innecesarias.
- Cambiar códigos canónicos después de uso real puede romper la colección local
  de Pedro si no existe procedimiento de migración.

## Decisiones pendientes

No quedan decisiones pendientes para cerrar el Incremento 1 del MVP.

## Material faltante

No falta material para producir el dataset mínimo del MVP. Para auditorías
futuras puede ser útil conservar fotos o escaneo del índice, checklist y páginas
de secciones del álbum físico.

## Criterio de finalización del Incremento 1

El Incremento 1 se considera completado porque existen todos estos elementos:

- `PANINI-00` documentada y validada.
- `FWC-1..FWC-19` documentadas y validadas.
- Lista exacta de las 48 selecciones confirmada.
- Nombre canónico de cada sección de selección confirmado.
- Posiciones `1..20` por selección confirmadas.
- Orden de presentación confirmado.
- Validación que produzca exactamente 980 posiciones únicas.
- Procedimiento reproducible de obtención documentado.
- Procedimiento de validación documentado y ejecutable.
- Verificación de que las figuritas promocionales quedan fuera del dataset.
