# 005. Estrategia PWA con caché explícita

## Estado

Aceptada.

## Contexto

El MVP debe poder instalarse y seguir funcionando sin conexión después de una
primera visita, pero la colección de Pedro vive en IndexedDB y no debe copiarse
a Cache Storage. La app no tiene backend, APIs remotas, cuentas ni
sincronización.

También había más de una opción razonable para implementar offline: service
worker propio, una librería de PWA o una caché dinámica más amplia.

## Decisión

Usar un service worker propio en `public/sw.js` con:

- generación posterior a `next build` desde una plantilla versionada, el
  `BUILD_ID` y el inventario completo de `.next/static`;
- precache explícito de rutas principales, manifest, iconos y todos los assets
  reales de la build;
- network-first para navegaciones de rutas principales con fallback cacheado sin
  conexión;
- caché runtime solo como red de seguridad para assets locales compatibles;
- no cachear payloads RSC de navegación interna de App Router;
- cachés versionadas con prefijo `figus-pani-` y sufijo ligado al `BUILD_ID`;
- registro de clientes anteriores en `activate` y limpieza diferida hasta que
  todos hayan recargado o se hayan cerrado;
- primera activación normal y actualizaciones coordinadas: el worker nuevo queda
  esperando mientras existe una página controlada y sólo usa `skipWaiting()` al
  recibir la acción explícita `Actualizar`.

Los datos de usuario quedan exclusivamente en IndexedDB y fuera de Cache
Storage.

## Alternativas consideradas

Librería PWA:
reduce código manual, pero agrega dependencia y configuración para un alcance
pequeño.

Caché dinámica amplia:
requiere menos mantenimiento de listas, pero aumenta el riesgo de guardar
solicitudes innecesarias o contenido que no pertenece al shell.

Actualizar solo en la próxima apertura:
es simple, pero puede dejar cachés viejas más tiempo y volver más confusa la
validación de una versión nueva.

## Consecuencias

La estrategia es explícita, testeable y fácil de auditar. Cuando se agregue una
ruta principal nueva habrá que actualizar la configuración estable y sus tests;
los chunks, CSS, fuentes e imports dinámicos no se mantienen manualmente.

El service worker puede servir el shell completo después de una sola instalación
online, sin visitar cada superficie. Las rutas fuera del shell deben mostrar una
limitación clara si no están disponibles.

Cuando hay conexión, las navegaciones del shell intentan red antes de Cache
Storage. Esto evita que una PWA instalada quede usando indefinidamente HTML viejo
si una publicación no cambia el contenido de `sw.js`.

Actualizar el service worker no borra IndexedDB, porque la colección no forma
parte de Cache Storage. Mantener el worker nuevo en `waiting` hasta la acción de
actualización, junto con la confirmación posterior de cada cliente, evita retirar
los chunks que todavía usa una página de la build anterior. El estado técnico de
la transición se persiste en la caché runtime vigente para que la limpieza no
dependa de que el proceso del service worker permanezca vivo.
