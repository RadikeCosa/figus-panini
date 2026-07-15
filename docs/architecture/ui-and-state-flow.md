# UI y flujo de estado

## Propósito

Este documento describe las primeras superficies navegables implementadas:
inicio con resumen y consulta rápida, álbum editable y entrada rápida.

La implementación actual permite abrir la ruta principal, cargar la colección
local mediante el repositorio, distinguir carga, éxito y error, y mostrar un
resumen real derivado del dominio. También permite consultar una posición por
sección y número para saber si falta, está pegada o está repetida.

La ruta `/album` permite recorrer el álbum canónico por sección, ver métricas de
la sección seleccionada, leer el estado de cada posición y corregir cantidades
con persistencia local.

La ruta `/quick-entry` permite registrar figuritas de a una con la misma
resolución canónica de sección y número que usa la consulta rápida.

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

Los placeholders de rutas futuras siguen siendo Server Components simples.

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

## Navegación inicial

La ruta `/` está implementada.

Existen rutas funcionales:

- `/album`: álbum navegable con edición de cantidades.
- `/quick-entry`: entrada rápida con persistencia y deshacer de la última suma.

Existen rutas placeholder para:

- `/missing`;
- `/duplicates`.

Cada placeholder indica que la funcionalidad todavía está pendiente y ofrece
volver al inicio. No simula comportamiento inexistente.

## Tests

Los tests de UI viven junto al componente:

```text
app/_components/collection-dashboard.test.tsx
app/album/_components/album-browser.test.tsx
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
- acceso para volver al inicio;
- accesos principales;
- placeholders honestos.

Los tests de dominio, persistencia y UI permanecen separados.

## Trade-offs

Estado local frente a estado global:
el estado local alcanza para esta primera carga. Evita Redux, Zustand, Context o
query tooling antes de necesitar coordinación entre pantallas.

Inyección de repositorio frente a acceso directo:
inyectar `createRepository` hace testeable el componente y mantiene IndexedDB
fuera de la presentación. El costo es una prop extra en el componente cliente.

Shell funcional frente a implementar todas las pantallas:
el shell permite validar composición, carga y navegación sin adelantar flujos
que todavía no existen.

Placeholders honestos frente a rutas inexistentes:
las rutas futuras ya tienen un destino claro y no rompen navegación. El costo es
mantener pantallas temporales hasta implementar cada flujo real.

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

## Fuera de alcance

Todavía no existe:

- vista real de faltantes;
- vista real de repetidas;
- backup o restauración;
- PWA;
- arquitectura global de estado.

## Relación con otros documentos

- [Modelo de dominio](domain-model.md)
- [Navegación del álbum](album-navigation.md)
- [Entrada rápida](quick-entry.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
