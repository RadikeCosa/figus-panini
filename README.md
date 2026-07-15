# Álbum de Pedro

App local y mobile-first para que Pedro gestione su álbum físico de figuritas
Panini del Mundial 2026 desde el teléfono.

## Propósito

Ayuda a registrar qué figuritas están pegadas, cuáles faltan y cuáles están
repetidas, sin cuentas, backend ni sincronización remota.

## Funcionalidades

- Resumen global de progreso sobre 980 posiciones canónicas.
- Consulta rápida por sección y número.
- Álbum navegable por secciones y grupos.
- Edición de cantidades desde el álbum.
- Entrada rápida para cargar figuritas recién abiertas.
- Vistas de faltantes y repetidas con filtros.
- Exportación y restauración de respaldo JSON validado.
- Persistencia local en IndexedDB.
- PWA instalable con uso offline después de una primera carga.

## Stack

- Next.js 16 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Vitest y Testing Library.
- IndexedDB nativo para persistencia local.
- Service worker propio para PWA/offline.

## Arquitectura

El dominio vive separado de UI y persistencia:

- `domain/album/`: definición canónica de las 980 posiciones.
- `domain/collection/`: reglas puras de colección, progreso, faltantes y
  repetidas.
- `domain/backup/`: contrato JSON de respaldo y validación.
- `infrastructure/persistence/`: adaptador IndexedDB.
- `app/`: rutas y componentes Next.js.
- `pwa/`: configuración testeable de caché offline.

## Ejecución local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Tests

```bash
npm test
npm run lint
```

## Build de producción

```bash
npm run build
npm run start
```

La validación PWA/offline debe hacerse sobre producción, no solo con `next dev`.

## PWA

La app define manifest, iconos, metadata y service worker. Después de una
primera visita online, quedan disponibles offline:

- `/`;
- `/album`;
- `/quick-entry`;
- `/missing`;
- `/duplicates`;
- `/backup`.

El service worker cachea shell, assets locales y navegación interna de esas
rutas. No cachea datos de usuario.

## Persistencia

La colección se guarda en IndexedDB del navegador como mapa disperso de
cantidades por posición. Las entradas con cantidad `0` no se persisten. La UI
accede a IndexedDB únicamente a través de `CollectionRepository`.

## Backup

El respaldo es un JSON versionado con `type: "figus-pani-backup"`,
`formatVersion: 1`, `exportedAt` y `copiesByPosition`. Importar un respaldo
reemplaza la colección completa solo después de validar estructura, versión,
fecha, posiciones y cantidades.

## Documentación

- Producto: `docs/product/`.
- Roadmap: `docs/planning/implementation-roadmap.md`.
- Arquitectura: `docs/architecture/`.
- Decisiones: `docs/decisions/`.
- Guía operativa para agentes: `AGENTS.md`.

## Estado del MVP

MVP funcional y cerrado según el roadmap vigente. El alcance sigue siendo
local/offline: no hay cuentas, backend, sincronización, analytics, OCR, cámara,
notificaciones push ni múltiples álbumes.

## Límites conocidos

- No incluye figuritas promocionales.
- No incluye nombres de jugadores, imágenes, escudos ni rareza.
- `/album` puede abrir una sección desde query string, pero no tiene deep link a
  una posición individual dentro de la grilla.
