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

- precache explícito de rutas principales, manifest e iconos;
- network-first para navegaciones de rutas principales con fallback cacheado sin
  conexión;
- caché runtime solo para assets locales versionados de Next.js;
- no cachear payloads RSC de navegación interna de App Router;
- cachés versionadas con prefijo `figus-pani-`;
- limpieza de versiones anteriores en `activate`;
- activación inmediata del nuevo worker y aviso discreto para recargar.

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
ruta principal nueva habrá que actualizar la lista de precache y sus tests.

El service worker puede servir el shell offline, pero no convierte rutas no
visitadas o desconocidas en funcionalidad completa. Las rutas fuera del shell
deben mostrar una limitación clara si no están disponibles.

Cuando hay conexión, las navegaciones del shell intentan red antes de Cache
Storage. Esto evita que una PWA instalada quede usando indefinidamente HTML viejo
si una publicación no cambia el contenido de `sw.js`.

Actualizar el service worker no borra IndexedDB, porque la colección no forma
parte de Cache Storage.
