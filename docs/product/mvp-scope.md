# Alcance del MVP

## Funcionalidades incluidas

- Revisar progreso general de la colección.
- Recorrer el álbum por figurita o por grupo lógico cuando exista la definición canónica.
- Registrar una figurita con su cantidad.
- Corregir la cantidad de una figurita.
- Consultar faltantes.
- Consultar repetidas.
- Exportar respaldo técnico.
- Restaurar respaldo técnico validado.
- Mantener persistencia local con comportamiento offline-first.

## Funcionalidades fuera de alcance

- Cuentas, autenticación o perfiles remotos.
- Sincronización entre dispositivos.
- Backend propio o servicios externos.
- OCR, cámara o automatización de captura.
- Social, rankings o comparación entre usuarios.
- Múltiples álbumes.
- Cualquier metadato del álbum que no esté confirmado por una fuente canónica.

## Flujos principales

### Revisar progreso

Pedro abre la app y ve el estado general de su colección, con una lectura rápida de lo poseído, faltante y repetido.

### Recorrer el álbum

Pedro navega el álbum para ver códigos válidos, estado por figurita y contexto de cada sección cuando la definición esté disponible.

### Registrar una figurita

Pedro agrega una figurita y la cantidad queda persistida de inmediato.

### Corregir cantidad

Pedro ajusta una cantidad sin tener que reconstruir la colección desde cero.

### Consultar faltantes

Pedro filtra o revisa solo las figuritas que aún no tiene.

### Consultar repetidas

Pedro revisa las figuritas con copias extras disponibles para cambio.

### Exportar respaldo

Pedro genera un archivo de respaldo técnico para conservar o transferir su colección.

### Restaurar respaldo

Pedro importa un respaldo validado y reemplaza la colección actual de forma atómica.

## Restricciones local-first y offline

- La app debe funcionar sin dependencia permanente de red.
- La persistencia primaria es local.
- El estado visible debe reflejar solo datos realmente guardados o cargados.
- El comportamiento offline debe ser predecible después de la primera carga.

## Criterios generales de aceptación

- La colección puede consultarse y editarse sin perder datos.
- Las cantidades no se vuelven negativas.
- Faltantes y repetidas se derivan de la cantidad real, no de flags guardados.
- Exportar e importar no altera datos inválidos ni deja estados parciales.
- El estado visible coincide con la persistencia local.

## Preguntas abiertas

- Fuente canónica de las 993 figuritas: pendiente de confirmación.
- Orden y nombres completos de las secciones: pendiente de confirmación.
- Formato exacto del backup técnico: pendiente de definición final si cambia respecto de la base actual.

## Relación con otros documentos

- [Definición del producto](../product/product-definition.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Decisiones](../decisions/README.md)
