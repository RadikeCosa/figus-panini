# Roadmap de implementación

Este documento guía la secuencia de trabajo. No registra trabajo ya realizado ni debe presentar como hecho lo que todavía está pendiente.

## Estados

- Pendiente: todavía no comienza.
- En curso: se está trabajando en el incremento.
- Completado: el incremento existe y fue validado.
- Bloqueado: depende de una decisión o insumo externo.

## Incrementos

### 1. Fundamentos documentales

- Estado: completado.
- Objetivo: separar definición del producto, alcance, planificación y decisiones.
- Alcance: crear la base documental mínima y sus enlaces.
- Dependencias: ninguna.
- Resultado verificable: existen `docs/product/`, `docs/planning/` y `docs/decisions/` con contenido inicial.
- Criterios de aceptación: los documentos son breves, no duplican `AGENTS.md` y describen el estado real.
- Validaciones esperadas: revisión manual de contenido y enlaces relativos.
- Documentación que debería actualizarse: este roadmap y, si cambia el criterio editorial, `docs/decisions/README.md`.

### 2. Definición canónica del álbum

- Estado: bloqueado.
- Objetivo: establecer la fuente única y validada de las 993 figuritas.
- Alcance: documentar la estructura oficial del álbum sin inventar códigos, nombres ni orden.
- Dependencias: confirmación de la fuente canónica.
- Resultado verificable: existe una definición validada del álbum lista para usar como base de dominio.
- Criterios de aceptación: no hay datos inferidos ni contradictorios.
- Validaciones esperadas: revisión de consistencia contra la fuente confirmada.
- Documentación que debería actualizarse: `docs/product/product-definition.md` y `docs/product/mvp-scope.md`.

### 3. Dominio puro

- Estado: pendiente.
- Objetivo: modelar álbum y colección con funciones puras y tipos explícitos.
- Alcance: validación de códigos, cálculos de progreso, faltantes y repetidas.
- Dependencias: definición canónica del álbum.
- Resultado verificable: existen reglas de dominio testeables sin depender de UI ni persistencia.
- Criterios de aceptación: los cálculos derivan del estado real y no guardan flags derivados.
- Validaciones esperadas: tests unitarios de dominio.
- Documentación que debería actualizarse: `docs/product/product-definition.md` y `docs/product/mvp-scope.md` si cambia el alcance.

### 4. Persistencia con IndexedDB

- Estado: pendiente.
- Objetivo: guardar y recuperar la colección localmente.
- Alcance: repositorio local, validación de escrituras y reemplazo atómico para restauración.
- Dependencias: dominio puro.
- Resultado verificable: la colección persiste y se recupera de forma confiable.
- Criterios de aceptación: no hay cantidades negativas, no se asume SSR y la restauración evita estados parciales.
- Validaciones esperadas: tests de persistencia e importación/exportación.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md` y, si aparece una decisión técnica, `docs/decisions/`.

### 5. Shell y navegación mobile-first

- Estado: pendiente.
- Objetivo: crear la estructura visible mínima para navegar el MVP desde celular.
- Alcance: navegación principal, layout responsive y acceso simple a las superficies del producto.
- Dependencias: dominio y persistencia base.
- Resultado verificable: la app se puede recorrer con una jerarquía clara y mobile-first.
- Criterios de aceptación: navegación simple, foco visible y sin dependencia de datos inventados.
- Validaciones esperadas: revisión visual y pruebas básicas de interacción.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md`.

### 6. Flujo principal del álbum

- Estado: pendiente.
- Objetivo: permitir revisar el álbum y corregir cantidades sin perder contexto.
- Alcance: vista de álbum, lectura de estado y edición de cantidad.
- Dependencias: shell, dominio y persistencia.
- Resultado verificable: Pedro puede ajustar una figurita y ver el cambio reflejado.
- Criterios de aceptación: los cambios se guardan y el estado visible coincide con la persistencia.
- Validaciones esperadas: pruebas de flujo y regresión de edición.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md`.

### 7. Entrada rápida

- Estado: pendiente.
- Objetivo: registrar figuritas nuevas con el menor número posible de pasos.
- Alcance: carga rápida de cantidades y retroalimentación inmediata.
- Dependencias: persistencia y flujo principal del álbum.
- Resultado verificable: una figurita puede sumarse y quedar persistida de inmediato.
- Criterios de aceptación: la acción es clara, reversible cuando aplique y sin fricción innecesaria.
- Validaciones esperadas: pruebas de interacción y persistencia.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md`.

### 8. Faltantes y repetidas

- Estado: pendiente.
- Objetivo: facilitar consultas y exportación de listas derivadas.
- Alcance: filtros, vistas resumidas y formatos de copia o exportación.
- Dependencias: dominio puro y datos persistidos.
- Resultado verificable: Pedro puede revisar faltantes y repetidas sin ambigüedad.
- Criterios de aceptación: se derivan desde la cantidad real y respetan el orden canónico cuando exista.
- Validaciones esperadas: tests de listas derivadas y formato.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md`.

### 9. Respaldo, restauración y PWA

- Estado: pendiente.
- Objetivo: cubrir exportación/importación confiable y la base progresiva de uso offline.
- Alcance: respaldo técnico validado, restauración atómica y preparativos de experiencia offline.
- Dependencias: persistencia estable y flujo principal funcional.
- Resultado verificable: se puede exportar, importar y seguir usando la app localmente.
- Criterios de aceptación: el respaldo valida estructura, evita merges silenciosos y no presenta éxito falso.
- Validaciones esperadas: tests de importación/exportación y verificación manual de offline.
- Documentación que debería actualizarse: `docs/product/mvp-scope.md` y, si aparecen decisiones técnicas, `docs/decisions/`.

### 10. Estabilización final

- Estado: pendiente.
- Objetivo: cerrar inconsistencias, validar supuestos y preparar el MVP para uso real.
- Alcance: correcciones finales, pulido de errores y documentación de decisiones relevantes.
- Dependencias: incrementos anteriores.
- Resultado verificable: el MVP queda coherente, estable y documentado.
- Criterios de aceptación: no quedan contradicciones entre documentos, código y estado real.
- Validaciones esperadas: lint, tests, typecheck y revisión funcional de las superficies críticas.
- Documentación que debería actualizarse: los documentos afectados por los cambios concretos y, si corresponde, `docs/decisions/`.

## Relación con otros documentos

- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
- [Decisiones](../decisions/README.md)
