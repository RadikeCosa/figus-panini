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
  disponible mientras el evento siga vigente.
- Android Chromium sin evento instalable: no se muestra un botón falso. Solo se
  muestra la ayuda breve `También podés instalarla desde el menú del navegador.`
  cuando la detección corresponde a Android con navegador Chromium compatible.
- iPhone/iPad: no existe botón de instalación directa desde la web. En modo
  navegador se muestra `Cómo agregarla` con los pasos de Safari: tocar
  Compartir, elegir Agregar a pantalla de inicio y tocar Agregar.
- Modo instalado/standalone: la invitación se oculta. La detección contempla
  `display-mode: standalone` y el estado equivalente expuesto por iOS en
  `navigator.standalone`.

El evento `appinstalled` limpia la invitación cuando el navegador informa que la
app quedó instalada. El runtime no accede al repositorio de colección ni a
IndexedDB para decidir instalabilidad.

## Service worker

El service worker vive en `../../public/sw.js`.

Usa dos cachés versionadas:

- `figus-pani-shell-v2`: rutas principales, manifest e iconos;
- `figus-pani-runtime-v2`: assets locales versionados de Next.js después de la
  primera carga.

En `install` precachea explícitamente:

- `/`;
- `/album`;
- `/quick-entry`;
- `/missing`;
- `/duplicates`;
- `/backup`;
- `/manifest.webmanifest`;
- iconos PWA.

En `activate` elimina cachés viejas con prefijo `figus-pani-` y conserva solo la
versión vigente.

## Estrategia de caché

La estrategia separa tres mundos:

- rutas de shell: cache-first hasta la próxima versión del service worker;
- assets locales: cache-first con guardado runtime después de la primera carga;
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
haya quedado disponible después de una visita online.

## Rutas disponibles offline

Después de una primera carga online quedan disponibles:

- `/`;
- `/album`;
- `/quick-entry`;
- `/missing`;
- `/duplicates`;
- `/backup`.

También quedan disponibles los assets locales y las solicitudes internas de
navegación de Next.js necesarias para esas rutas cuando ya fueron solicitados al
menos una vez.

## IndexedDB

La colección sigue viviendo en IndexedDB mediante el repositorio documentado en
[Persistencia local](persistence.md). El service worker no lee, escribe ni copia
la colección.

Esto implica:

- modificar cantidades offline sigue usando IndexedDB;
- exportar backup offline lee la colección desde IndexedDB y genera un archivo
  local;
- restaurar backup offline lee el archivo elegido por el usuario y reemplaza
  IndexedDB mediante `CollectionRepository.save()`;
- actualizar el service worker no borra la colección.

## Actualización

La actualización elegida es activación inmediata segura:

1. el browser detecta una nueva versión de `/sw.js`;
2. el worker nuevo instala su caché versionada;
3. `skipWaiting()` permite activar la versión nueva sin esperar otra apertura;
4. `activate` limpia cachés viejas;
5. el runtime muestra un aviso discreto para recargar cuando detecta una versión
   nueva con una página ya controlada.

Trade-off: Pedro recibe la versión nueva rápido y las cachés viejas no quedan
indefinidamente. El costo es que una pestaña abierta puede necesitar recarga
manual para usar todos los assets nuevos.

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
- guía específica de iPhone/iPad sin botón falso;
- ayuda de menú para Android Chromium cuando no hay evento instalable;
- ocultamiento de invitaciones en modo standalone;
- primera carga online;
- navegación y recarga offline de rutas principales;
- edición de colección offline;
- entrada rápida offline;
- faltantes y repetidas offline;
- exportación y restauración offline;
- actualización del service worker sin borrar IndexedDB;
- consola sin errores ni warnings relevantes.

La validación en desktop Chromium sirve como apoyo técnico, pero no reemplaza la
prueba en teléfonos reales. Android Chrome, otros Chromium móviles e iOS/iPadOS
deben validarse por separado porque no exponen la misma API de instalación.

## Limitaciones

`/album` es una ruta dinámica en el build de Next.js. El service worker cachea la
ruta base `/album` durante la primera visita online. Una nueva versión del
service worker vuelve a instalar el shell y actualiza esa respuesta cacheada.
Las solicitudes RSC usadas por la navegación cliente de App Router no se guardan
en Cache Storage porque son payloads internos dependientes de la versión y el
estado del router.

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
se eligió precache explícito para no guardar solicitudes inesperadas ni datos
del usuario. El costo es mantener la lista cuando cambien las rutas principales.

Actualización inmediata frente a próxima apertura:
se eligió activación inmediata con aviso de recarga para limpiar versiones
viejas rápido. El costo es que una pestaña abierta puede requerir recarga.

Rutas completas offline frente a fallback limitado:
se cachean las rutas del MVP, assets locales y navegación interna de App Router.
Para rutas no cubiertas se muestra un mensaje claro en vez de simular contenido.

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
