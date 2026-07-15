# UI y flujo de estado

## Propósito

Este documento describe las primeras superficies navegables implementadas:
inicio con resumen y consulta rápida, álbum editable, entrada rápida, faltantes
y repetidas, respaldo y restauración.

La implementación actual permite abrir la ruta principal, cargar la colección
local mediante el repositorio, distinguir carga, éxito y error, y mostrar un
resumen real derivado del dominio. También permite consultar una posición por
sección y número para saber si falta, está pegada o está repetida. La identidad
PWA, el estado offline y el aviso de actualización viven en un runtime cliente
separado para no convertir toda la aplicación en Client Component.

La ruta `/album` permite recorrer el álbum canónico por sección, ver métricas de
la sección seleccionada, leer el estado de cada posición y corregir cantidades
con persistencia local.

La ruta `/quick-entry` permite registrar figuritas de a una con la misma
resolución canónica de sección y número que usa la consulta rápida.

La ruta `/missing` muestra una lista de solo lectura derivada de la colección
persistida. La ruta `/duplicates` muestra repetidas y permite registrar
entregas o corregir cantidades de esas posiciones.

La ruta `/backup` permite exportar y restaurar la colección con un contrato JSON
versionado y validado antes de reemplazar datos.

## Frontera Server y Client Components

`app/page.tsx` se mantiene como Server Component. Define la estructura principal
de la pantalla, la identidad visual de la aplicación y la composición general.

`app/_components/collection-dashboard.tsx` es Client Component porque necesita:

- estado React local;
- `useEffect` para cargar la colección;
- botón de reintento;
- formulario de consulta rápida;
- acceso al repositorio concreto del navegador.

`app/album/page.tsx` se mantiene como Server Component y compone
`app/album/_components/album-browser.tsx`, que es Client Component porque
necesita cargar IndexedDB, manejar reintentos, mantener la sección seleccionada
localmente y guardar cambios de cantidad.

`app/quick-entry/page.tsx` se mantiene como Server Component y compone
`app/quick-entry/_components/quick-entry-flow.tsx`, que es Client Component
porque necesita cargar IndexedDB, manejar el campo de entrada, sugerencias,
guardado inmediato, rollback y deshacer de la última carga.

`app/missing/page.tsx` y `app/duplicates/page.tsx` se mantienen como Server
Components y componen `app/_components/collection-views.tsx`, que es Client
Component porque carga IndexedDB, mantiene el filtro local, proyecta listas
derivadas y, en repetidas, guarda correcciones mediante el repositorio.

`app/backup/page.tsx` se mantiene como Server Component y compone
`app/backup/_components/backup-manager.tsx`, que es Client Component porque
carga IndexedDB, descarga archivos, lee archivos seleccionados y guarda la
colección restaurada mediante el repositorio.

`app/_components/pwa-runtime.tsx` es Client Component porque registra el service
worker, escucha eventos `online`/`offline` y muestra un aviso discreto de nueva
versión. No accede a la colección, no abre IndexedDB y no modifica rutas.

Las superficies principales actuales son rutas funcionales, no placeholders.

## Composición del repositorio

La composición concreta vive en
`../../app/repositories/browser-collection-repository.ts`.

Ese punto crea el repositorio IndexedDB del navegador con
`createIndexedDbCollectionRepository`. La UI no conoce:

- nombre de base IndexedDB;
- object stores;
- formato persistido;
- normalización de datos guardados.

`CollectionDashboard` recibe opcionalmente una función `createRepository`. En
producción usa el repositorio del navegador. En tests se inyecta un repositorio
falso que implementa el contrato `CollectionRepository`.

## Estados de carga

El estado local del dashboard es explícito:

- `loading`: se está abriendo IndexedDB y cargando colección;
- `ready`: existe una `CollectionState` válida;
- `error`: la carga falló.

Durante `loading` no se muestra una colección vacía provisional. Esto evita
flashes de métricas falsas.

Durante `ready` se renderiza el resumen.

Durante `error` se muestra un mensaje comprensible y un botón para reintentar.
El error técnico se registra en consola para desarrollo.

La consulta rápida tiene estado local propio:

- texto ingresado;
- resultado de consulta o error normal de entrada.
- apertura de sugerencias;
- opción activa para navegación por teclado.

Ese estado no se comparte globalmente y no se persiste.

La pantalla de álbum usa el mismo contrato conceptual de carga:

- `loading`: se está abriendo IndexedDB y cargando colección;
- `ready`: existe una `CollectionState` válida;
- `error`: la carga falló.

Su estado local adicional incluye la sección seleccionada, el estado de guardado
y la colección cargada. Cambiar de sección no vuelve a leer IndexedDB.

Al editar desde `/album`, la UI aplica primero la operación pura del dominio al
estado local, guarda la colección completa con `repository.save()` y muestra un
estado discreto:

- `Guardando cambios...`;
- `Cambios guardados.`;
- `No fue posible guardar. Se restauró el estado anterior.`

Mientras un guardado está pendiente, los controles de cantidad quedan
deshabilitados. Esto serializa las operaciones de forma simple y evita que taps
rápidos sobrescriban una colección más reciente. Si el guardado falla, la UI
restaura la colección previa y conserva la sección seleccionada.

## Flujo de carga inicial

1. La página server renderiza el shell.
2. El Client Component monta con estado `loading`.
3. Se instancia el repositorio del navegador.
4. Se llama `repository.load()`.
5. Si carga correctamente, se guarda la colección en estado `ready`.
6. Si falla, se pasa a estado `error`.
7. El botón `Reintentar` vuelve a ejecutar la carga.

## Métricas derivadas desde dominio

El resumen usa funciones públicas del dominio:

- `getGlobalProgress`;
- `getUniqueOwnedCount`;
- `listMissingPositions`;
- `getDuplicateCopyCount`.

La UI no recorre manualmente `copiesByPosition` para reconstruir reglas de
negocio.

Las métricas visibles son:

- progreso `pegadas / total`;
- figuritas pegadas;
- faltantes;
- copias repetidas;
- porcentaje completado.

El porcentaje se redondea sin decimales.

## Consulta rápida

El dashboard incluye un formulario de solo lectura para consultar una posición
del álbum con entradas como:

- `Argentina 7`;
- `México 12`;
- `PANINI 00`;
- `FWC 4`;
- `Corea del Sur 18`.

El formulario usa la `CollectionState` ya cargada en memoria. Consultar no
vuelve a llamar a IndexedDB, no guarda datos y no modifica cantidades.

La UI delega en el dominio:

- normalización del nombre de sección;
- resolución del nombre canónico;
- parsing de la consulta textual;
- validación de rango de la posición;
- cálculo de copias totales y repetidas.

Los errores normales se muestran como mensajes breves asociados al campo:

- consulta vacía;
- sección desconocida;
- número ausente;
- posición no numérica;
- posición fuera de rango;
- `PANINI` distinto de `00`;
- `FWC` fuera de `1` a `19`;
- selección fuera de `1` a `20`.

El resultado se anuncia en una región `aria-live` y distingue:

- faltante: `No la tenés.`;
- pegada sin repetidas: `La tenés.`;
- pegada con repetidas: `La tenés repetida.`.

Las sugerencias de sección provienen del dataset canónico, no de una lista
duplicada en UI. Incluyen `PANINI`, `FWC` y las 48 selecciones.

La lógica reutilizable del dominio:

- separa el texto parcial de sección y la posición ya escrita;
- normaliza con las mismas reglas de la consulta;
- prioriza coincidencias por prefijo;
- agrega coincidencias por contenido solo después de las de prefijo;
- limita la lista visible a 6 resultados;
- conserva el número si el usuario ya lo escribió.

Ejemplo:

```text
core 18 -> Corea del Sur 18
```

La UI usa un combobox pequeño con lista personalizada porque el `datalist`
nativo no permite controlar de forma consistente flechas, Escape,
`aria-activedescendant` ni la conservación selectiva de la posición. El campo
tiene `role="combobox"` y la lista usa `role="listbox"` con opciones
`role="option"`.

Interacción:

- las sugerencias aparecen solo cuando hay texto útil;
- se ocultan cuando la consulta ya es una posición válida;
- click o toque completan la sección;
- flechas cambian la opción activa;
- Enter elige solo si hay opción activa;
- Enter consulta normalmente si no hay opción activa;
- Escape cierra la lista.

La misma lógica de parsing y resolución se reutiliza en entrada rápida, donde sí
hay escritura y persistencia.

## Entrada rápida

La ruta `/quick-entry` reutiliza `parsePositionQuery` y
`getCanonicalSectionSuggestions`. El flujo separa consulta y escritura:

1. Pedro escribe o elige sección y número.
2. El formulario resuelve la posición contra el álbum canónico y muestra su
   estado actual.
3. El botón `Agregar copia` suma una copia con `addCopy`.
4. La UI guarda la colección completa mediante `CollectionRepository.save()`.
5. Si el guardado termina bien, limpia el campo, devuelve el foco al input y
   muestra una confirmación con `Deshacer`.

El deshacer no es un historial general. Solo revierte la última suma exitosa de
la sesión visible y usa `removeCopy`.

Durante un guardado pendiente, el campo y los botones quedan deshabilitados. Si
`save()` falla, la UI restaura la colección previa y muestra el mismo error
operativo que usa el álbum editable:

```text
No fue posible guardar. Se restauró el estado anterior.
```

La arquitectura detallada del flujo vive en [Entrada rápida](quick-entry.md).

## Faltantes y repetidas

`/missing` y `/duplicates` cargan la colección una vez con
`CollectionRepository.load()` y derivan sus listas en memoria. Filtrar por
sección no vuelve a leer IndexedDB.

Las vistas reutilizan proyecciones puras de dominio:

- `buildMissingCollectionView`;
- `buildDuplicateCollectionView`;
- `listCollectionSectionOptions`;
- `buildAlbumSectionHref`.

`/missing` muestra total faltante, progreso global, secciones con faltantes,
cantidad faltante por sección, progreso de sección y posiciones faltantes.

`/duplicates` muestra copias repetidas totales, cantidad de posiciones con
repetidas y, por sección, cada posición con copias totales y copias repetidas.

Cada posición repetida separa dos acciones:

- `Entregué una`: registra un intercambio ya realizado. Usa `removeCopy`, resta
  una sola copia, nunca elimina la copia principal y ofrece `Deshacer` solo para
  esa última entrega exitosa.
- `Corregir cantidad`: abre un editor compacto de cantidad total. Usa
  `setCopies`, permite aumentar, disminuir o guardar `0`, y advierte que la
  figurita quedará marcada como faltante antes de confirmar cero.

Ambas acciones aplican primero la operación pura del dominio sobre la colección
local, guardan la colección completa con `repository.save()` y recalculan la
vista desde el estado resultante. Durante el guardado, los controles quedan
deshabilitados. Si el guardado falla, la UI restaura la colección previa y
muestra un error con `role="alert"` sin volver a cargar todo.

Ambas vistas usan un `select` nativo con `optgroup` para filtrar por sección y
enlaces `Ver en álbum` hacia `/album?section=...`.

La arquitectura detallada vive en [Vistas de colección](collection-views.md).

## Respaldo y restauración

`/backup` carga la colección actual una vez mediante `CollectionRepository`.

La exportación:

1. construye un backup desde la colección cargada;
2. serializa JSON legible;
3. descarga un archivo `figus-pani-backup-YYYY-MM-DD.json`;
4. no envía datos a ningún servidor.

La restauración:

1. lee un archivo `.json` seleccionado;
2. valida tipo, versión, fecha y `copiesByPosition`;
3. normaliza contra el dominio;
4. muestra comparación entre colección actual y respaldo;
5. exige confirmación explícita;
6. reemplaza la colección completa con `repository.save()`.

Si la validación o el guardado fallan, no se reemplaza la colección actual. La
arquitectura detallada vive en [Backup y restauración](backup-and-restore.md).

## Navegación inicial

La ruta `/` está implementada.

Existen rutas funcionales:

- `/album`: álbum navegable con edición de cantidades.
- `/quick-entry`: entrada rápida con persistencia y deshacer de la última suma.
- `/missing`: lista funcional de faltantes con filtro por sección.
- `/duplicates`: lista funcional de repetidas con filtro por sección, entrega
  de repetidas y corrección de cantidad total.
- `/backup`: exportación y restauración validada de la colección.

No quedan placeholders dentro de las superficies principales actuales.

## Tests

Los tests de UI viven junto al componente:

```text
app/_components/collection-dashboard.test.tsx
app/_components/collection-views.test.tsx
app/album/_components/album-browser.test.tsx
app/backup/_components/backup-manager.test.tsx
app/quick-entry/_components/quick-entry-flow.test.tsx
```

Usan React Testing Library con jsdom. No prueban IndexedDB real; inyectan
repositorios falsos mediante el contrato `CollectionRepository`.

Cubren:

- estado inicial de carga;
- colección vacía cargada;
- resumen con copias y repetidas;
- error de carga;
- reintento exitoso;
- render del buscador;
- consulta faltante;
- consulta con una copia;
- consulta repetida;
- errores de sección y número;
- envío con Enter;
- sugerencias progresivas;
- selección de sugerencias con click y teclado;
- conservación del número al elegir sugerencia;
- cierre de sugerencias con Escape;
- ausencia de llamadas adicionales al repositorio al consultar;
- ausencia de llamadas adicionales al repositorio al mostrar sugerencias;
- conservación del resumen durante la consulta;
- funcionamiento de la consulta después de reintentar una carga fallida;
- álbum loading/ready/error;
- sección inicial `PANINI`;
- navegación a `FWC`;
- navegación entre grupos de selecciones;
- sección de selección con 20 posiciones;
- posición faltante, pegada y repetida;
- métricas por sección;
- ausencia de nuevas lecturas del repositorio al navegar secciones;
- suma y resta de copias desde una posición;
- botón de resta deshabilitado en cero;
- guardado de la colección resultante;
- bloqueo de controles mientras se guarda;
- rollback ante error de guardado;
- reintento después de error;
- ausencia de nuevas lecturas del repositorio al editar;
- entrada rápida loading/ready/error;
- consulta de una posición antes de sumar;
- sugerencias de sección por click y teclado;
- suma de primera copia y copia repetida;
- bloqueo de doble suma durante guardado;
- rollback ante error de guardado;
- deshacer de la última suma exitosa;
- rollback ante error al deshacer;
- persistencia visible tras remount del flujo;
- soporte de `PANINI`, `FWC` y selecciones;
- vistas de faltantes loading/ready/error;
- colección vacía con 980 faltantes;
- colección completa sin faltantes;
- agrupación y orden canónico de faltantes;
- filtros de faltantes sin recargar;
- vista de repetidas vacía;
- diferencia entre posiciones repetidas y copias repetidas;
- agrupación y orden canónico de repetidas;
- filtros de repetidas sin recargar;
- entrega de una repetida con persistencia y desaparición al quedar una copia;
- bloqueo de doble entrega durante guardado;
- rollback y reintento ante error al entregar;
- deshacer de la última entrega y rollback ante error al deshacer;
- editor de corrección de cantidad, cancelación, aumento, disminución y cero;
- advertencia accesible antes de guardar cero;
- rechazo de cantidades negativas, decimales o texto;
- rollback ante error al corregir cantidad;
- enlaces desde faltantes y repetidas hacia `/album?section=...`;
- apertura de `/album` con sección inicial válida y fallback inválido;
- apertura de `/album` desde la URL visible aunque el service worker entregue el
  shell cacheado de la ruta base;
- respaldo loading/ready/error;
- exportación de colección vacía y parcial;
- nombre de archivo de backup;
- lectura y validación de archivo;
- vista previa y comparación actual/respaldo;
- confirmación requerida antes de restaurar;
- restauración exitosa y error de guardado con reintento;
- bloqueo de doble confirmación;
- rechazo de archivos demasiado grandes;
- acceso para volver al inicio;
- accesos principales;

Los tests de dominio, persistencia y UI permanecen separados.

## Trade-offs

Estado local frente a estado global:
el estado local alcanza para esta primera carga. Evita Redux, Zustand, Context o
query tooling antes de necesitar coordinación entre pantallas.

Inyección de repositorio frente a acceso directo:
inyectar `createRepository` hace testeable el componente y mantiene IndexedDB
fuera de la presentación. El costo es una prop extra en el componente cliente.

Shell funcional frente a estado global:
la ruta principal compone resumen, consulta y accesos a superficies reales sin
introducir un estado global de aplicación.

Carga explícita frente a asumir colección vacía:
mostrar loading evita datos falsos mientras IndexedDB abre. El costo es un
estado visual adicional.

Consulta de solo lectura frente a entrada rápida:
la consulta del inicio permite verificar estado sin escribir datos; entrada
rápida separa esa acción de la carga persistida para mantener el resumen simple.

Bloqueo breve de edición frente a cola de mutaciones:
durante `repository.save()` los controles de cantidad quedan deshabilitados.
Esto prioriza consistencia y rollback sencillo sobre velocidad extrema de taps
consecutivos. IndexedDB local debería responder rápido, y la UI evita mantener
un estado que no pudo persistirse.

Filtros locales frente a nuevas lecturas:
faltantes y repetidas cargan una vez y filtran la proyección en memoria. El
costo es mantener la selección local; el beneficio es lectura rápida y cero
riesgo de tratar errores de carga como datos vacíos.

Vista previa explícita frente a restauración inmediata:
backup valida y compara antes de guardar. El costo es un paso extra; el
beneficio es evitar reemplazos accidentales.

## Fuera de alcance

Todavía no existe:

- arquitectura global de estado.

## Relación con otros documentos

- [Modelo de dominio](domain-model.md)
- [Navegación del álbum](album-navigation.md)
- [Entrada rápida](quick-entry.md)
- [Vistas de colección](collection-views.md)
- [Backup y restauración](backup-and-restore.md)
- [PWA y funcionamiento offline](pwa-and-offline.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
