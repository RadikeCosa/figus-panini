# Arquitectura de persistencia local

## Propósito

La capa de persistencia local permite guardar y recuperar la colección de Pedro
en IndexedDB sin mezclar reglas de dominio con APIs del navegador.

Esta capa resuelve:

- conservar la colección entre sesiones del navegador;
- cargar una colección guardada como `CollectionState` válido;
- guardar el estado completo de colección producido por el dominio;
- validar datos persistidos antes de devolverlos a la aplicación.

Queda fuera de su responsabilidad:

- definir las 980 posiciones del álbum;
- calcular progreso, faltantes o repetidas;
- manejar UI, estado React o rutas;
- cachear el shell PWA o assets estáticos;
- sincronizar entre dispositivos o usuarios.

## Fronteras arquitectónicas

El sistema vigente separa estas responsabilidades:

- Dominio del álbum: `domain/album/canonical-album.ts` define las 980 posiciones
  canónicas y su orden global.
- Dominio de colección: `domain/collection/collection.ts` representa cantidades
  de copias, valida posiciones, normaliza datos externos y deriva progreso,
  faltantes y repetidas.
- Contrato de persistencia: `CollectionRepository` define cómo cargar, guardar y
  limpiar una colección sin exponer IndexedDB.
- Adaptador IndexedDB: `indexeddb-collection-repository.ts` implementa ese
  contrato usando la API nativa del navegador.
- UI: consume el repositorio y las funciones de dominio; no debe acceder
  directamente a IndexedDB.
- Backup: `domain/backup/collection-backup.ts` define un contrato JSON externo
  separado del formato interno de IndexedDB.
- PWA: el service worker cachea shell y assets, pero no lee ni persiste la
  colección.

La frontera importante es que la UI no debe abrir bases IndexedDB ni leer object
stores. Debe pedir una colección al repositorio, aplicar cambios con funciones
puras del dominio y guardar el nuevo estado mediante el repositorio. Las
consultas usan la colección cargada en memoria y no vuelven a consultar
IndexedDB; si una consulta habilita una acción contextual, esa acción persiste
la colección completa mediante `CollectionRepository.save()`.

## Contrato del repositorio

El contrato vigente está en
`../../infrastructure/persistence/collection-repository.ts`:

```ts
interface CollectionRepository {
  load(): Promise<CollectionState>;
  save(collection: CollectionState): Promise<void>;
  clear(): Promise<void>;
}
```

`load()` carga la colección activa. Si no existe dato persistido, devuelve una
colección vacía válida.

`save(collection)` reemplaza la colección activa por el estado recibido.

`clear()` elimina la colección activa. Después de limpiar, una carga vuelve a
producir colección vacía.

El contrato opera con `CollectionState` del dominio porque la persistencia no
debe crear una representación paralela de la colección. IndexedDB es un detalle
del adaptador concreto; la aplicación debe razonar en términos del dominio.

## Formato persistido

El formato vigente de la colección guardada es:

```ts
{
  formatVersion: 1,
  copiesByPosition: Record<string, number>
}
```

`copiesByPosition` es disperso: solo contiene posiciones con cantidad positiva.
Las posiciones ausentes equivalen a `0` copias.

El formato no incluye las 980 posiciones porque la definición canónica ya vive
en el dominio del álbum. Duplicarla en IndexedDB abriría la puerta a
inconsistencias entre catálogo y colección.

Tampoco incluye nombres de jugadores, imágenes, escudos, rareza, promociones ni
otros metadatos del álbum. La persistencia guarda únicamente el estado mutable:
cuántas copias tiene Pedro.

Al cargar, el dato persistido se considera entrada externa. Aunque haya sido
escrito por la misma app, puede estar corrupto, venir de una versión vieja o
haber sido alterado por herramientas del navegador. Por eso se valida estructura
y versión, y luego se normaliza con reglas del dominio.

Este formato no es el formato de backup. El backup comparte conceptos como
`formatVersion` y `copiesByPosition`, pero agrega `type` y `exportedAt` y se
valida como contrato externo transportable.

## Formato de backup

El respaldo manual vigente es JSON legible:

```ts
{
  type: "figus-pani-backup",
  formatVersion: 1,
  exportedAt: string,
  copiesByPosition: Record<string, number>
}
```

`copiesByPosition` usa la misma clave técnica reversible del dominio, pero el
contrato de backup no se considera idéntico al registro IndexedDB. El respaldo
incluye identificador de tipo y fecha de exportación porque circula fuera del
navegador y debe poder validarse antes de restaurar.

La restauración no escribe directamente en IndexedDB. La UI valida el backup,
obtiene una `CollectionState` normalizada y reemplaza la colección activa
mediante `CollectionRepository.save()`.

## Versionado

Existen dos versiones distintas:

- Versión de esquema IndexedDB: `COLLECTION_DB_SCHEMA_VERSION`, hoy `1`.
- Versión lógica del formato persistido: `COLLECTION_FORMAT_VERSION`, hoy `1`.

La versión de esquema IndexedDB cambia cuando cambia la estructura física de la
base: object stores, índices, claves o migraciones del almacenamiento local.

La versión lógica del formato cambia cuando cambia la forma del dato guardado:
campos, semántica de `copiesByPosition`, reglas de versión o estructura de
colección.

No hay migraciones implementadas todavía. El punto de extensión existe en la
apertura versionada de IndexedDB y en la validación de `formatVersion`.

## Flujo de carga

El flujo real de `load()` es:

1. Abrir la base IndexedDB `figus-pani` con versión de esquema `1`.
2. Leer la colección activa desde el object store `collections` con clave
   `active`.
3. Si no hay dato persistido, devolver `createEmptyCollection()`.
4. Validar que el dato tenga estructura de objeto y `formatVersion: 1`.
5. Validar que `copiesByPosition` sea un objeto.
6. Normalizar `copiesByPosition` con `normalizeCollection`.
7. Si hay issues de normalización, lanzar error explícito.
8. Devolver un `CollectionState` válido.

La base se cierra al terminar la operación.

## Flujo de guardado

El flujo real de `save(collection)` es:

1. Recibir un `CollectionState` del dominio.
2. Generar el formato persistido con `serializeCollection`.
3. Copiar `copiesByPosition` para no depender de mutaciones posteriores del
   objeto original.
4. Abrir una transacción `readwrite`.
5. Reemplazar la colección activa en `collections` con clave `active`.
6. Propagar errores de request o transacción como `CollectionPersistenceError`.
7. Cerrar la base al finalizar.

El guardado es completo: cada `save` reemplaza el registro activo entero.

## Manejo de errores

IndexedDB no disponible:
se lanza `CollectionPersistenceError` indicando que IndexedDB no está disponible
en ese entorno.

Apertura fallida:
se propaga como `CollectionPersistenceError` con el mensaje de la request cuando
existe.

Base bloqueada:
se informa como error explícito de apertura bloqueada.

Transacción abortada:
se propaga como `CollectionPersistenceError`; la operación no se considera
exitosa.

Dato inexistente:
se interpreta como colección vacía válida.

Estructura corrupta:
si el dato persistido no es objeto o `copiesByPosition` no es objeto, se lanza
error explícito.

Versión no soportada:
si `formatVersion` no coincide con la versión vigente, se lanza error explícito.

Claves desconocidas:
`normalizeCollection` las reporta como `unknown-position`; la carga falla con
error explícito.

Cantidades inválidas:
valores no numéricos, negativos o decimales se reportan como
`invalid-quantity`; la carga falla con error explícito.

Los datos corruptos no se reemplazan silenciosamente por una colección vacía.
Solo la ausencia de dato persistido se trata como colección vacía.

## Compatibilidad con servidor

IndexedDB solo existe en navegador.

Los módulos de dominio pueden importarse en servidor porque no dependen del
navegador. El contrato `CollectionRepository` también puede importarse en
servidor porque solo describe una interfaz.

El adaptador concreto no abre la base al importarse. La apertura ocurre recién
cuando se llama a `load`, `save` o `clear`.

El adaptador debe instanciarse y usarse únicamente en un contexto donde exista
IndexedDB. Si se ejecuta sin IndexedDB, falla con un error claro.

## Relación con PWA

El funcionamiento offline no cambia el contrato de persistencia. Cuando la app
se abre desde Cache Storage o sin red, las pantallas siguen cargando y guardando
la colección mediante IndexedDB.

El service worker no debe cachear la colección ni respaldos generados por el
usuario. Cache Storage guarda únicamente el shell, rutas principales, manifest,
iconos y assets locales necesarios para ejecutar la app. IndexedDB conserva el
estado mutable y no se elimina al instalar o actualizar el service worker.

## Tests

Los tests de persistencia usan `fake-indexeddb` para ejecutar la API IndexedDB en
Vitest sin navegador real.

Cubren:

- carga inicial sin datos;
- guardar y recuperar colección;
- persistir varias copias;
- omitir entradas con cero;
- reemplazar completamente una colección anterior;
- aislar el dato persistido del objeto original;
- validar `formatVersion`;
- rechazar versiones no soportadas;
- rechazar estructuras corruptas;
- normalizar datos almacenados válidos;
- rechazar claves desconocidas;
- rechazar cantidades inválidas;
- fallar claramente sin IndexedDB;
- abrir repetidamente sin perder datos;
- limpiar la colección activa.

No se prueban mediante componentes React porque esta capa no depende de UI. Los
tests ejercitan directamente el contrato de repositorio y el adaptador
IndexedDB.

## Invariantes

- Existe una sola colección activa.
- El formato persistido vigente es versión `1`.
- El esquema IndexedDB vigente es versión `1`.
- La colección persistida es dispersa.
- Las entradas con cero no se persisten.
- La definición del álbum no se duplica en IndexedDB.
- Toda carga valida el dato persistido.
- Dato inexistente significa colección vacía.
- Dato corrupto significa error explícito.
- La UI no accede directamente a IndexedDB.
- El backup es un contrato externo separado del formato persistido interno.
- Restaurar un backup reemplaza la colección completa; no hay merge.
- El service worker no es fuente de verdad de la colección.

## Trade-offs

IndexedDB nativo frente a librería wrapper:
evita dependencias y mantiene visible el contrato real del navegador. El costo
es más código alrededor de requests, transacciones y errores.

Guardado completo frente a actualizaciones incrementales:
simplifica consistencia y reemplazo atómico de la colección activa. El costo es
reescribir el registro completo, aceptable para un estado disperso pequeño.

Una colección activa frente a múltiples colecciones:
calza con el MVP de un único álbum de Pedro. El costo es que múltiples álbumes o
usuarios requerirían ampliar el contrato.

Formato disperso frente a 980 registros:
reduce almacenamiento y evita persistir ceros. El costo es que las faltantes se
derivan cruzando contra el álbum canónico.

Formato interno frente a backup:
mantener contratos separados evita que un detalle de IndexedDB quede congelado
como formato transportable. El costo es mantener validación y documentación para
ambos contratos.

Errores explícitos frente a recuperación silenciosa:
protege datos corruptos de ser descartados sin aviso. El costo es que la UI debe
mostrar errores y caminos de recuperación.

Repositorio pequeño frente a API extensa:
reduce superficie prematura. El costo es que flujos futuros pueden necesitar
nuevas operaciones si aparece una necesidad real.

## Fuera de alcance

La persistencia local no implementa:

- migraciones entre versiones;
- múltiples usuarios;
- sincronización;
- historial de cambios.

## Relación con otras capas

La UI debe:

- cargar la colección mediante `CollectionRepository.load`;
- aplicar cambios con funciones del dominio como `addCopy`, `removeCopy` o
  `setCopies`;
- guardar el nuevo estado mediante `CollectionRepository.save`;
- manejar estados de carga y error;
- evitar duplicar reglas de copias, progreso, faltantes y repetidas.

El backup comparte ideas con el formato persistido local, pero no se acopla
directamente a IndexedDB. Tiene su propio contrato público y validación.

## Relación con otros documentos

- [Modelo de dominio](domain-model.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Decisión 002: identidad mínima de posiciones](../decisions/002-identidad-minima-de-posiciones.md)
- [Decisión 003: formato persistido de colección local](../decisions/003-formato-persistido-coleccion-local.md)
- [PWA y funcionamiento offline](pwa-and-offline.md)
- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
