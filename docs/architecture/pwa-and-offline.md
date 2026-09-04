# PWA y funcionamiento offline

## Propósito

La app funciona como PWA instalable y mantiene disponibles las superficies
principales después de una primera visita online. El objetivo es que Pedro pueda
abrir el álbum desde el icono instalado y seguir leyendo o modificando su
colección local aunque el teléfono no tenga conexión.

Queda fuera de alcance:

- backend;
- cuentas;
- sincronización remota;
- analytics;
- notificaciones push;
- background sync;
- caché de datos de usuario en Cache Storage.

## Manifest e identidad

El manifest vive en `../../app/manifest.ts`, siguiendo la convención local de
Next.js para App Router.

Define:

- nombre instalado: `Álbum de Pedro`;
- nombre corto: `Figuritas`;
- descripción: `Gestión local de figuritas del Mundial 2026`;
- `start_url: "/"`;
- `scope: "/"`;
- `display: "standalone"`;
- color de tema `#064e3b`;
- color de fondo `#f4f4f5`;
- iconos PNG de `192x192`, `512x512` y variante `maskable`.

La metadata del layout usa la misma identidad y enlaza
`/manifest.webmanifest`.

## Iconos

Los iconos están en `../../public/icons/`.

El diseño es propio y genérico: una figurita estilizada sobre fondo verde. No
usa logos de Panini, FIFA, selecciones ni material protegido.

Archivos:

- `icon-192.png`;
- `icon-512.png`;
- `maskable-512.png`;
- `source.svg`, fuente editable local.

## Registro

`../../app/_components/pwa-runtime.tsx` registra `/sw.js` como mejora
progresiva desde un Client Component aislado. El layout sigue siendo Server
Component y solo compone ese runtime al final del body.

El registro:

- ocurre solo en navegador;
- requiere soporte de `navigator.serviceWorker`;
- se habilita solo en `production`;
- no corre durante tests;
- usa `scope: "/"`;
- usa `updateViaCache: "none"`;
- ignora errores de registro sin romper la app.

En desarrollo no se registra un worker nuevo para evitar interferencias con
`next dev`.

## Instalación por plataforma

`../../app/_components/pwa-runtime.tsx` también centraliza la invitación de
instalación. La instalación es una mejora progresiva y se separa por plataforma:

- Android/desktop Chromium: si el navegador emite `beforeinstallprompt`, el
  runtime guarda temporalmente el evento, cancela el comportamiento automático
  con `preventDefault()` y muestra un bloque compacto con `Usar como app` e
  `Instalar app`. El prompt se ejecuta solo después del toque explícito. Si el
  usuario acepta, la invitación se oculta; si cancela, la acción queda
  disponible mientras el evento siga vigente, salvo que Pedro cierre el aviso.
- Android Chromium sin evento instalable: no se muestra un botón falso. Solo se
  muestra la ayuda breve `También podés instalarla desde el menú del navegador.`
  cuando la detección corresponde a Android con navegador Chromium compatible.
  La ayuda puede cerrarse.
- iPhone/iPad: no existe botón de instalación directa desde la web. En modo
  navegador se muestra `Cómo agregarla` con los pasos de Safari: tocar
  Compartir, elegir Agregar a pantalla de inicio y tocar Agregar. La ayuda
  puede cerrarse.
- Modo instalado/standalone: la invitación se oculta. La detección contempla
  `display-mode: standalone` y el estado equivalente expuesto por iOS en
  `navigator.standalone`.

Cuando solo hay ayuda de instalación, se muestra como bloque dentro del flujo al
final de la app para no tapar controles de la portada. Puede cerrarse y respeta
`safe-area-inset-bottom`. Los avisos operativos de offline y actualización se
mantienen como avisos fijos sobre el borde inferior visible, con altura máxima
acotada. Si hay un aviso operativo visible, la ayuda de instalación no se apila
encima.

El evento `appinstalled` limpia la invitación cuando el navegador informa que la
app quedó instalada. El runtime no accede al repositorio de colección ni a
IndexedDB para decidir instalabilidad.

## Service worker

El service worker vive en `../../public/sw.js`.

El archivo servido como `/sw.js` es un artefacto de build generado desde:

- `../../pwa/service-worker.template.js`, plantilla versionada;
- `../../pwa/offline-config.json`, rutas y assets públicos estables;
- `../../scripts/generate-service-worker.mjs`, inventario y generación.

El worker concreto no se versiona: `npm run build` ejecuta primero `next build`
y después lee `.next/BUILD_ID` y recorre `.next/static` para generar
`public/sw.js`. Next 16.2.10 sirve `public/` desde el directorio del proyecto al
iniciar `next start`, de modo que el worker generado después de compilar queda
disponible como `/sw.js` sin ejecutar una segunda build. El script
`npm run verify:pwa-build` comprueba que el archivo corresponde exactamente a la
salida vigente.

Usa dos cachés ligadas al `BUILD_ID` real:

- `figus-pani-shell-<BUILD_ID>`: rutas principales, manifest, iconos y todos los
  archivos reales de `.next/static`;
- `figus-pani-runtime-<BUILD_ID>`: red de seguridad para assets locales
  compatibles que aparezcan después del precache.

En `install` precachea explícitamente:

- `/`;
- `/album`;
- `/quick-entry`;
- `/missing`;
- `/duplicates`;
- `/backup`;
- `/manifest.webmanifest`;
- iconos PWA;
- todos los chunks, CSS, fuentes y demás archivos generados bajo `.next/static`.

La instalación termina sólo si `cache.addAll` puede obtener la lista completa.
Si un recurso falta, el worker nuevo no se instala y una versión activa anterior
no se reemplaza por un shell parcial.

En `activate` identifica las cachés viejas con prefijo `figus-pani-`, pero no las
elimina mientras puedan existir páginas de esas versiones. Guarda en la caché
runtime vigente un estado técnico de transición con los nombres obsoletos y los
IDs de clientes pendientes. No contiene datos de colección. La limpieza se
completa cuando esos clientes confirman que recargaron bajo el worker vigente o
cuando `clients.matchAll()` confirma que ya se cerraron.

## Estrategia de caché

La estrategia separa tres mundos:

- rutas de shell: network-first cuando hay conexión, fallback cacheado sin
  conexión;
- assets locales: primero el precache completo del build y luego cache-first;
  runtime caching queda sólo como red de seguridad;
- navegación interna de App Router: las solicitudes RSC no se cachean en el
  service worker; deben llegar a la versión activa de Next.js;
- datos de usuario: únicamente IndexedDB, nunca Cache Storage.

El service worker no cachea solicitudes remotas, métodos distintos de `GET` ni
datos de respaldo seleccionados por el usuario. Tampoco intenta cachear APIs que
no existen en el MVP.

Las navegaciones de shell se cachean por `pathname`, no por cada query string.
Esto evita guardar una copia arbitraria de `/album` para cada parámetro posible.
Cuando la URL visible incluye una sección, por ejemplo:

```text
/album?section=México
```

el navegador conserva esa URL y el cliente de `/album` lee `section` desde la
URL visible. Así el shell cacheado de `/album` puede abrir la sección solicitada
también bajo control del service worker y offline, siempre que la ruta del álbum
haya quedado disponible después de una visita online. Cuando hay conexión, la
navegación intenta red primero con `cache: "no-store"` y actualiza la entrada
cacheada, para evitar que una instalación siga usando HTML viejo.

## Rutas disponibles offline

Después de que termina la primera instalación online quedan disponibles, sin
necesidad de visitar manualmente cada superficie:

- `/`;
- `/album`;
- `/quick-entry`;
- `/missing`;
- `/duplicates`;
- `/backup`.

También quedan disponibles todos los assets locales generados por esa build. Las
solicitudes RSC no se persisten. En Next.js 16.2.10, si una navegación cliente no
puede obtener su payload RSC por estar offline, degrada a navegación completa;
el service worker responde entonces con el HTML y los assets precacheados.

`/missing` forma parte del shell offline. La vista lee la colección desde
IndexedDB y puede revisar faltantes sin conexión después de la primera carga
online. La generación del PDF usa un generador cargado dinámicamente, pero el
inventario incluye automáticamente su loader, el chunk que contiene `pdf-lib` y
cualquier dependencia emitida dentro de `.next/static`. Por eso el primer uso de
`Compartir PDF` también queda preparado durante el precache inicial, sin
hardcodear nombres de chunks ni generar antes un PDF online.

## IndexedDB

La colección sigue viviendo en IndexedDB mediante el repositorio documentado en
[Persistencia local](persistence.md). El service worker no lee, escribe ni copia
la colección.

Esto implica:

- modificar cantidades offline sigue usando IndexedDB;
- exportar backup offline lee la colección desde IndexedDB y genera un archivo
  local;
- generar el PDF de faltantes offline usa la colección ya cargada desde
  IndexedDB y los chunks preparados durante la instalación;
- restaurar backup offline lee el archivo elegido por el usuario y reemplaza
  IndexedDB mediante `CollectionRepository.save()`;
- actualizar el service worker no borra la colección.

El PDF de faltantes no se almacena en IndexedDB ni en Cache Storage. Compartir o
descargar usa APIs locales del navegador y no escribe datos de colección.

## Actualización

La actualización distingue primera instalación de reemplazo de una versión:

1. el browser detecta una nueva versión de `/sw.js`;
2. el worker nuevo instala su caché versionada;
3. en la primera instalación, como no existe un worker activo anterior, el ciclo
   normal del navegador permite activarlo sin interacción;
4. si ya existe una versión controlando la página, el nuevo worker queda
   `waiting` y conserva intactos los cachés anteriores;
5. el runtime muestra un aviso discreto para recargar cuando detecta una versión
   nueva con una página ya controlada, incluyendo workers que ya estaban en
   `registration.waiting` al montar;
6. al tocar `Actualizar`, la UI le envía `SKIP_WAITING`;
7. durante `activate`, el worker registra qué clientes todavía pueden estar
   ejecutando la versión anterior y llama a `clients.claim()`, sin borrar todavía
   sus cachés;
8. cuando ocurre `controllerchange`, cada cliente viejo recarga una sola vez;
9. la página ya cargada bajo el worker vigente envía una vez `CLIENT_READY`. Si
   todavía quedan clientes anteriores, el worker responde
   `CACHE_CLEANUP_PENDING` y el cliente agenda un único reintento; cada respuesta
   pendiente rearma ese mismo seguimiento, sin timers paralelos. Cuando el worker
   responde `CACHE_CLEANUP_COMPLETE`, cancela cualquier reintento. Un worker
   anterior que no entiende el protocolo no responde y, por lo tanto, nunca
   inicia polling;
10. recién cuando todos los IDs anteriores confirmaron la nueva versión o ya no
    aparecen en `clients.matchAll()`, el worker elimina todas las cachés obsoletas.

El estado de transición queda persistido en Cache Storage para sobrevivir a la
terminación y reinicio del proceso del service worker. Así una página vieja
conserva sus chunks aunque otra pestaña recargue antes. Cerrar un cliente viejo
deja de hacerlo bloqueante; la eliminación efectiva ocurre en la siguiente
confirmación de un cliente vigente. Si no queda ninguno abierto, las cachés
anteriores pueden permanecer temporalmente y se limpian en la siguiente apertura
controlada por esta versión. Esta retención es deliberada y segura. En una
primera instalación sin cachés anteriores no se crea una transición ni se fuerza
una recarga.

## Estado offline

El runtime muestra un aviso discreto solo cuando el navegador informa estar sin
conexión:

```text
Sin conexión · tus datos siguen disponibles en este dispositivo
```

El aviso no bloquea operaciones locales.

## Desarrollo local

`next dev` no registra el service worker. La validación PWA debe hacerse con:

```bash
npm run build
npm run start
```

Si un navegador ya tenía un service worker de una corrida anterior, conviene
usar un perfil limpio de Chromium o borrar el registro desde DevTools antes de
probar desarrollo.

## Validación en producción

La validación real debe ejecutarse sobre build de producción. Para este
incremento se verifican:

- manifest detectado;
- iconos disponibles;
- service worker registrado;
- captura de `beforeinstallprompt` cuando Chromium lo permite;
- `Instalar app` visible solo cuando existe un evento instalable;
- ejecución del prompt solo después de una acción explícita;
- manejo de aceptación, cancelación y `appinstalled`;
- cierre explícito de la invitación o ayuda de instalación;
- guía específica de iPhone/iPad sin botón falso;
- ayuda de menú para Android Chromium cuando no hay evento instalable;
- ocultamiento de invitaciones en modo standalone;
- primera carga online;
- precache completo sin visitar manualmente las demás rutas;
- navegación y recarga offline de rutas principales;
- edición de colección offline;
- entrada rápida offline;
- faltantes y repetidas offline;
- primer uso de generación de PDF de faltantes offline;
- exportación y restauración offline;
- actualización del service worker sin borrar IndexedDB;
- consola sin errores ni warnings relevantes.

La validación en desktop Chromium sirve como apoyo técnico, pero no reemplaza la
prueba en teléfonos reales. Android Chrome, otros Chromium móviles e iOS/iPadOS
deben validarse por separado porque no exponen la misma API de instalación.

## Limitaciones

`/album` es una ruta dinámica en el build de Next.js. El service worker cachea la
ruta base `/album` durante la primera visita online y la actualiza en
navegaciones posteriores con conexión. Una nueva versión del service worker
vuelve a instalar el shell y limpia las respuestas antiguas cuando ya no quedan
clientes de la versión anterior.
Las solicitudes RSC usadas por la navegación cliente de App Router no se guardan
en Cache Storage porque son payloads internos dependientes de la versión y el
estado del router. El fallback a navegación completa de Next.js 16.2.10 forma
parte del smoke requerido al actualizar Next.

La garantía empieza cuando la instalación del worker completó su precache. Como
en cualquier PWA, cerrar el navegador antes de que termine la instalación puede
dejar la preparación pendiente hasta la próxima apertura online.

Recargas directas offline de rutas principales están cubiertas. En `/album`, el
query `section` se preserva como parte de la URL visible y se resuelve en el
cliente contra las secciones canónicas. Si la sección es inválida, `/album`
vuelve a `PANINI`.

No se usa un fallback engañoso para rutas desconocidas: si una ruta no pertenece
al shell y no está cacheada, se muestra una página mínima de ruta no disponible
sin conexión.

## Trade-offs

Service worker propio frente a librería:
se eligió un worker propio porque el alcance es pequeño y evita dependencias o
configuración webpack adicional.

Precache explícito frente a caché dinámica amplia:
se eligió precache explícito generado desde la salida real para no guardar
solicitudes inesperadas ni datos del usuario. Las rutas estables se mantienen a
mano; los hashes y archivos de Next.js se inventarían automáticamente.

Actualización inmediata frente a activación coordinada:
se conserva activación explícita mediante el aviso de recarga. El worker no usa
`skipWaiting()` durante `install`; sólo responde al mensaje `SKIP_WAITING` de la
acción `Actualizar`.

Network-first para shell frente a cache-first:
se eligió intentar red en navegaciones de shell para que una PWA instalada reciba
HTML nuevo aunque el contenido de `sw.js` no cambie en cada publicación. El costo
es una navegación online levemente más dependiente de red, conservando fallback
offline cacheado.

Rutas completas offline frente a fallback limitado:
se cachean las rutas del MVP y todos los assets locales de la build. Los RSC no
se persisten. Para rutas no cubiertas se muestra un mensaje claro en vez de
simular contenido.

Indicador offline frente a funcionamiento silencioso:
se agregó un aviso breve porque ayuda a entender que los datos siguen locales.
No bloquea acciones.

Recursos locales frente a dependencias remotas:
los iconos y el service worker son locales. No se agregan recursos remotos para
la experiencia PWA.

## Relación con otros documentos

- [Persistencia local](persistence.md)
- [Backup y restauración](backup-and-restore.md)
- [UI y flujo de estado](ui-and-state-flow.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Decisiones](../decisions/README.md)
