# Roadmap de implementación

Este documento guía la secuencia de trabajo. No registra trabajo ya realizado ni debe presentar como hecho lo que todavía está pendiente.

## Estados

- Pendiente: todavía no comienza.
- En curso: se está trabajando en el incremento.
- Completado: el incremento existe y fue validado.
- Bloqueado: depende de una decisión o insumo externo.

## Incrementos

### 0. Fundamentos documentales

- Estado: completado.
- Objetivo: separar definición del producto, alcance, planificación y decisiones.
- Alcance: crear la base documental mínima y sus enlaces.
- Dependencias: ninguna.
- Resultado verificable: existen `docs/product/`, `docs/planning/` y `docs/decisions/` con contenido inicial.
- Criterios de aceptación: los documentos son breves, no duplican `AGENTS.md` y describen el estado real.
- Validaciones esperadas: revisión manual de contenido y enlaces relativos.
- Documentación que debería actualizarse: este roadmap y, si cambia el criterio editorial, `docs/decisions/README.md`.

### 1. Definición canónica del álbum

- Estado: completado.
- Objetivo: establecer la definición mínima y validada de las 980 posiciones estándar.
- Alcance: documentar `PANINI-00`, `FWC-1..FWC-19` y 48 selecciones con posiciones `1..20`, sin inventar nombres canónicos de selecciones; las figuritas promocionales quedan fuera del MVP.
- Dependencias: ninguna pendiente para el MVP.
- Resultado verificable: existe una definición validada del álbum lista para
  usar como base de dominio, con trazabilidad hacia la fuente confirmada.
- Criterios de aceptación: no hay datos inferidos ni contradictorios; el total,
  `PANINI-00`, `FWC-1..FWC-19`, las 48 selecciones, sus posiciones `1..20`, el
  orden de presentación y la exclusión de promocionales están confirmados; el
  procedimiento de obtención y validación es reproducible.
- Validaciones esperadas: revisión de consistencia contra la fuente confirmada,
  conteo total de 980 posiciones únicas, completitud por sección, orden estable y
  verificación de que las promocionales no integran el dataset canónico.
- Documentación que debería actualizarse:
  `docs/data/album-source-research.md` y, si cambia el alcance confirmado del
  producto, `docs/product/product-definition.md` y `docs/product/mvp-scope.md`.

### 2. Dominio puro

- Estado: completado.
- Objetivo: modelar álbum y colección con funciones puras y tipos explícitos.
- Alcance: validación de posiciones canónicas, cálculos de progreso, faltantes,
  repetidas, totales y normalización de estado externo.
- Dependencias: definición canónica del álbum.
- Resultado verificable: existen reglas de dominio testeables sin depender de UI ni persistencia.
- Criterios de aceptación: los cálculos derivan del estado real, no guardan flags
  derivados, no dependen del navegador ni de persistencia, e impiden cantidades
  inválidas o posiciones desconocidas.
- Validaciones esperadas: tests unitarios de dominio.
- Documentación que debería actualizarse: `docs/product/product-definition.md` y `docs/product/mvp-scope.md` si cambia el alcance.

### 3. Persistencia con IndexedDB

- Estado: completado.
- Objetivo: guardar y recuperar la colección localmente.
- Alcance: contrato de repositorio local, adaptador IndexedDB, formato
  persistido versionado y validación de datos al cargar.
- Dependencias: dominio puro.
- Resultado verificable: la colección persiste y se recupera de forma confiable.
- Criterios de aceptación: no hay cantidades negativas, no se asume IndexedDB
  fuera del navegador, los datos persistidos se tratan como entrada externa y no
  se reemplazan datos inválidos silenciosamente.
- Validaciones esperadas: tests de persistencia local e integridad del formato.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md` y, si aparece una decisión técnica, `docs/decisions/`.

### 4. Shell y navegación mobile-first

- Estado: completado.
- Objetivo: crear la estructura visible mínima para navegar el MVP desde celular.
- Alcance: navegación principal, layout responsive, carga inicial, resumen real y
  consulta rápida de figuritas de solo lectura con sugerencias progresivas de
  sección.
- Dependencias: dominio y persistencia base.
- Resultado verificable: la app se puede recorrer con una jerarquía clara y mobile-first.
- Criterios de aceptación: navegación simple, foco visible, resumen derivado del
  dominio, consulta rápida contra la colección cargada, sugerencias canónicas
  accesibles y sin dependencia de datos inventados.
- Validaciones esperadas: tests de dominio y UI, lint, build y revisión breve en
  navegador.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md`.

#### 4A. Shell y carga inicial

- Estado: completado.
- Alcance: ruta principal mobile-first, carga inicial desde `CollectionRepository`,
  estados loading/ready/error, resumen derivado del dominio y accesos a las
  superficies principales.
- Resultado verificable: `/` carga la colección local, muestra métricas reales y
  ofrece accesos a Álbum, Carga rápida, Faltantes y Repetidas.
- Validaciones esperadas: tests de UI con repositorio inyectado, lint y build.

#### 4B. Resumen funcional y consulta rápida

- Estado: completado.
- Alcance: mantener el resumen global, agregar consulta rápida de solo lectura
  por sección y número, resolver secciones canónicas con normalización y mostrar
  estado faltante, pegada o repetida desde la colección cargada.
- Resultado verificable: `/` permite consultar entradas como `Argentina 7`,
  `México 12`, `PANINI 00`, `FWC 4` o `Corea del Sur 18` sin recargar ni guardar
  colección.
- Validaciones esperadas: tests de dominio y UI con repositorio inyectado, lint,
  build y validación manual en navegador.

#### 4C. Sugerencias progresivas de sección

- Estado: completado.
- Alcance: agregar sugerencias canónicas al campo de consulta rápida mientras se
  escribe la sección, con coincidencia normalizada, límite de resultados,
  selección por click o teclado y conservación del número ya escrito.
- Resultado verificable: el campo sugiere `PANINI`, `FWC` y selecciones desde el
  dataset canónico sin recargar ni guardar colección.
- Validaciones esperadas: tests de dominio y UI con repositorio inyectado, lint,
  build y validación breve en navegador mobile.

### 5. Flujo principal del álbum

- Estado: completado.
- Objetivo: permitir revisar el álbum y corregir cantidades sin perder contexto.
- Alcance: vista de álbum, lectura de estado y edición de cantidad persistida.
- Dependencias: shell, dominio y persistencia.
- Resultado verificable: Pedro puede recorrer secciones del álbum, ajustar una
  figurita y ver el cambio persistido.
- Criterios de aceptación: la vista deriva estados desde la colección cargada,
  guarda cambios mediante `CollectionRepository`, actualiza métricas y revierte
  la UI si un guardado falla.
- Validaciones esperadas: pruebas de flujo y regresión de edición.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md`.

#### 5A. Álbum navegable de solo lectura

- Estado: completado.
- Alcance: `/album` carga la colección local, permite seleccionar `PANINI`,
  `FWC` o una selección por grupo, muestra métricas por sección y renderiza la
  grilla de posiciones con estados faltante, pegada o repetida.
- Resultado verificable: la pantalla recorre el álbum canónico sin editar ni
  guardar cantidades.
- Validaciones esperadas: tests de UI con repositorio inyectado, lint, build y
  validación en navegador.

#### 5B. Edición y persistencia desde álbum

- Estado: completado.
- Alcance: permitir modificar cantidades desde la vista de álbum, persistir el
  cambio y reflejarlo sin perder contexto.
- Resultado verificable: cada posición permite agregar o quitar copias, muestra
  estado de guardado y revierte al estado anterior ante error de persistencia.
- Validaciones esperadas: tests de UI con repositorio inyectado, lint, build y
  validación en navegador con IndexedDB real.

### 6. Entrada rápida

- Estado: completado.
- Objetivo: registrar figuritas nuevas con el menor número posible de pasos.
- Alcance: carga rápida por sección y número, sugerencias progresivas, suma de
  una copia, deshacer de la última carga exitosa y persistencia inmediata.
- Dependencias: persistencia y flujo principal del álbum.
- Resultado verificable: una figurita puede sumarse y quedar persistida de inmediato.
- Criterios de aceptación: la acción es clara, reutiliza la validación canónica,
  bloquea controles durante el guardado, revierte ante error y permite deshacer
  solo la última suma exitosa.
- Validaciones esperadas: pruebas de interacción con repositorio inyectado,
  lint, build y validación en navegador con IndexedDB real.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md` y
  `docs/architecture/quick-entry.md` si cambia el flujo.

### 7. Faltantes y repetidas

- Estado: completado.
- Objetivo: facilitar consultas de listas derivadas.
- Alcance: vistas funcionales de faltantes y repetidas, filtros por sección,
  agrupación canónica y navegación hacia la sección correspondiente del álbum.
- Dependencias: dominio puro y datos persistidos.
- Resultado verificable: Pedro puede revisar faltantes y repetidas sin ambigüedad.
- Criterios de aceptación: se derivan desde la cantidad real, distinguen
  posiciones con repetidas de copias repetidas, respetan el orden canónico, no
  modifican la colección y no recargan IndexedDB al filtrar.
- Validaciones esperadas: tests de dominio y UI con repositorio inyectado,
  lint, build y validación en navegador con IndexedDB real.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md` y
  `docs/architecture/collection-views.md` si cambian las vistas derivadas.

### 8. Respaldo, restauración y PWA

- Estado: completado.
- Objetivo: cubrir exportación/importación confiable y la base progresiva de uso offline.
- Alcance: respaldo técnico validado, restauración atómica, PWA instalable,
  service worker y funcionamiento offline de las superficies principales.
- Dependencias: persistencia estable y flujo principal funcional.
- Resultado verificable: se puede exportar, importar y seguir usando la app localmente.
- Criterios de aceptación: el respaldo valida estructura, evita merges
  silenciosos y no presenta éxito falso; la PWA tiene manifest, iconos,
  service worker versionado, caché acotada, actualización documentada y no
  cachea datos de usuario.
- Validaciones esperadas: tests de importación/exportación, tests PWA, lint,
  build y verificación en navegador de producción.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md` y, si aparecen decisiones técnicas, `docs/decisions/`.

#### 8A. Respaldo y restauración

- Estado: completado.
- Alcance: ruta `/backup`, exportación JSON versionada, validación conservadora,
  vista previa comparativa, confirmación explícita y reemplazo completo mediante
  `CollectionRepository.save()`.
- Resultado verificable: Pedro puede exportar un archivo de respaldo, validar un
  respaldo seleccionado y restaurarlo sin merge ni escritura directa a IndexedDB.
- Validaciones esperadas: tests de dominio y UI con repositorio inyectado, lint,
  build y validación en navegador con IndexedDB real.

#### 8B. PWA y offline

- Estado: completado.
- Alcance: manifest, iconos, service worker, caché mínima y validación offline.
- Resultado verificable: la app puede instalarse y abrir superficies principales
  sin conexión después de una primera carga.
- Validaciones esperadas: tests de manifest, registro, indicador offline y
  configuración de caché; lint; build; revisión en navegador de producción de
  instalación, actualización y comportamiento offline.

### 9. Estabilización final

- Estado: completado.
- Objetivo: cerrar inconsistencias, validar supuestos y preparar el MVP para uso real.
- Alcance: correcciones finales, pulido de errores y documentación de decisiones relevantes.
- Dependencias: incrementos anteriores.
- Resultado verificable: el MVP queda coherente, estable y documentado.
- Criterios de aceptación: no quedan contradicciones entre documentos, código y estado real.
- Validaciones esperadas: tests, lint, build, validación de producción con
  Chromium y revisión funcional de las superficies críticas.
- Documentación que debería actualizarse: los documentos afectados por los cambios concretos y, si corresponde, `docs/decisions/`.

## Relación con otros documentos

- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
- [Decisiones](../decisions/README.md)
