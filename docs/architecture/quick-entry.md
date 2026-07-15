# Entrada rápida

## Propósito

`/quick-entry` es el flujo para registrar figuritas recién abiertas con el menor
número posible de pasos. Está separado del álbum navegable para que la carga
repetitiva no dependa de recorrer secciones ni de mantener contexto visual de
grilla.

## Flujo

1. La pantalla carga la colección con `CollectionRepository.load()`.
2. El campo acepta consultas como `México 1`, `Argentina 7`, `PANINI 00` o
   `FWC 4`.
3. La consulta se resuelve con `parsePositionQuery`.
4. Si la posición existe, se muestra si está faltante, pegada o repetida y la
   cantidad actual.
5. `Agregar copia` aplica `addCopy` y guarda la colección completa con
   `CollectionRepository.save()`.
6. Al guardar bien, el campo se limpia, el foco vuelve al input y queda visible
   una confirmación con `Deshacer`.

La consulta y la suma son acciones separadas. Consultar no guarda datos.

## Sugerencias

El campo reutiliza `getCanonicalSectionSuggestions`, la misma fuente de
sugerencias que usa el dashboard. No mantiene una lista duplicada de secciones.

Las sugerencias:

- se calculan desde el texto actual;
- respetan normalización de acentos y mayúsculas;
- completan la sección y conservan el número si ya fue escrito;
- pueden elegirse por click, toque, flechas y Enter;
- se cierran con Escape o al perder foco.

## Persistencia

La pantalla usa el mismo contrato `CollectionRepository` que el dashboard y el
álbum. En producción se compone con el repositorio IndexedDB del navegador; en
tests se inyecta un repositorio falso.

El guardado es conservador:

- se calcula la colección siguiente con funciones puras del dominio;
- la UI muestra el cambio mientras `save()` está pendiente;
- los controles quedan deshabilitados durante ese guardado;
- si `save()` falla, se restaura la colección previa;
- no se encadenan múltiples escrituras simultáneas desde la pantalla.

## Deshacer

`Deshacer` solo revierte la última suma exitosa que sigue visible en la pantalla.
No es un historial general ni una transacción pendiente.

La reversión usa `removeCopy` sobre la misma posición. Si el guardado del
deshacer falla, se restaura el estado anterior y la última suma sigue disponible
para intentar nuevamente.

## Foco y continuidad

Después de una suma exitosa o de un deshacer exitoso, el foco vuelve al campo de
entrada. Esto permite cargar varias figuritas seguidas desde teclado móvil o
físico sin tocar otra zona de la pantalla.

## Layout mobile y teclado

La ruta está optimizada para teléfonos angostos y uso con teclado virtual
abierto. La cabecera conserva contexto, pero evita ocupar gran parte del primer
viewport. El formulario mantiene el input como control dominante, con altura
táctil cómoda y el botón `Consultar` cerca del campo.

Las sugerencias siguen usando la misma lógica de dominio, pero la lista visible
tiene altura máxima y scroll interno para no empujar permanentemente el resto del
flujo. El estado de la figurita se muestra en formato compacto:

```text
Argentina 7
Faltante · 0 copias
```

`Agregar copia`, confirmación y `Deshacer` quedan cerca del resultado para
reducir el desplazamiento durante cargas repetidas.

## Fuera de alcance

Este flujo no implementa:

- historial completo de ingresos;
- edición arbitraria de cantidades;
- captura por cámara u OCR;
- lectura de códigos no canónicos.

## Validaciones

La cobertura automatizada vive en:

```text
app/quick-entry/_components/quick-entry-flow.test.tsx
```

Los tests inyectan repositorios falsos y cubren carga, error de carga,
sugerencias, consulta, suma, repetidas, bloqueo durante guardado, rollback,
deshacer y persistencia visible al remonte del componente. La validación con
IndexedDB real se realiza en navegador durante el cierre del incremento.

## Relación con otros documentos

- [UI y flujo de estado](ui-and-state-flow.md)
- [Navegación del álbum](album-navigation.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
