# UI y flujo de estado inicial

## Propósito

Este documento describe la primera superficie navegable implementada para el
Incremento 4A: shell mobile-first y carga inicial de la colección.

La implementación actual permite abrir la ruta principal, cargar la colección
local mediante el repositorio, distinguir carga, éxito y error, y mostrar un
resumen real derivado del dominio. Todavía no permite modificar la colección.

## Frontera Server y Client Components

`app/page.tsx` se mantiene como Server Component. Define la estructura principal
de la pantalla, la identidad visual de la aplicación y la composición general.

`app/_components/collection-dashboard.tsx` es Client Component porque necesita:

- estado React local;
- `useEffect` para cargar la colección;
- botón de reintento;
- acceso al repositorio concreto del navegador.

Los placeholders de rutas futuras son Server Components simples. No necesitan
estado de navegador.

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

## Navegación inicial

La ruta `/` está implementada.

Existen rutas placeholder para:

- `/album`;
- `/quick-entry`;
- `/missing`;
- `/duplicates`.

Cada placeholder indica que la funcionalidad todavía está pendiente y ofrece
volver al inicio. No simula comportamiento inexistente.

## Tests

Los tests de UI viven junto al componente:

```text
app/_components/collection-dashboard.test.tsx
```

Usan React Testing Library con jsdom. No prueban IndexedDB real; inyectan
repositorios falsos mediante el contrato `CollectionRepository`.

Cubren:

- estado inicial de carga;
- colección vacía cargada;
- resumen con copias y repetidas;
- error de carga;
- reintento exitoso;
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

## Fuera de alcance

Todavía no existe:

- edición de figuritas;
- entrada rápida funcional;
- vista real de álbum;
- vista real de faltantes;
- vista real de repetidas;
- backup o restauración;
- PWA;
- arquitectura global de estado.

## Relación con otros documentos

- [Modelo de dominio](domain-model.md)
- [Persistencia local](persistence.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
