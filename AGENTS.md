# AGENTS.md

Guía operativa para trabajar en este repositorio. Debe mantenerse corta y
accionable: si una regla no cambia una decisión de implementación, no pertenece
acá.

## Contexto

* App Next.js mobile-first para que Pedro gestione su álbum físico de figuritas
  Panini del Mundial 2026.
* El uso principal es desde celular, con el álbum o paquetes abiertos al lado.
* Prioridades: rapidez, claridad, seguridad de datos, persistencia local y cero
  infraestructura innecesaria.
* La app usa `app/` en la raíz. Antes de cambios no triviales en Next.js,
  revisar la versión instalada, dependencias y documentación local disponible en
  `node_modules/next/dist/docs/`.

## Reglas de producto

* Usar español en toda copia visible.
* Usar consistentemente `figuritas`; no mezclar con `stickers` o `cards`.
* Optimizar para interacción táctil rápida y pocos pasos.
* Preferir controles explícitos y estados comprensibles sin instrucciones.
* Mantener el MVP local/offline. No agregar cuentas, autenticación, backend,
  ORM, Prisma, Supabase, Firebase, analytics, cámara, OCR, social, múltiples
  usuarios, múltiples álbumes ni sincronización remota salvo pedido explícito.
* Hacer parches pequeños, testeables y sin rediseñar superficies no relacionadas.

Terminología visible recomendada:

```text
Figuritas
Álbum
Repetidas
Faltantes
Para cambiar
Cantidad
Agregar
Quitar
Copiar lista
Exportar respaldo
Importar respaldo
```

## Álbum

El álbum canónico del MVP tiene exactamente 980 figuritas:

* Incluye únicamente las figuritas que ocupan espacios en el álbum físico
  estándar.
* Excluye figuritas promocionales, incluidas las de Coca-Cola.
* Las promocionales no participan del progreso, faltantes, repetidas, búsqueda
  ni backup.

Los códigos son identificadores canónicos, por ejemplo `ARG7`, `USA12` o
`FWC3` cuando estén confirmados por la fuente del álbum. No usar nombres de
jugadores como identificadores.

No agregar secciones, códigos, jugadores ni metadatos no confirmados. La
definición del dataset no está completa hasta contar con los 980 códigos,
secciones y orden confirmado del álbum estándar. No inferir el orden por ranking
FIFA, grupos, orden alfabético, estructura del torneo ni fuentes no verificadas.

## Dominio

Separar siempre la definición estática del álbum de la colección de Pedro.

```ts
type AlbumSection = {
  code: string;
  name: string;
  order: number;
  firstNumber: number;
  lastNumber: number;
  type: "team" | "world-cup" | "sponsor";
};

type StickerDefinition = {
  code: string;
  sectionCode: string;
  number: number;
  order: number;
};

type CollectionEntry = {
  stickerCode: string;
  quantity: number;
  updatedAt: string;
};
```

Reglas de colección:

* Normalizar códigos con `trim()` y `toUpperCase()`.
* Validar contra la definición real del álbum, no solo con regex.
* `quantity` es un entero no negativo.
* `updatedAt` es ISO 8601 y representa la última modificación persistida.
* No persistir flags derivados como `owned`, `missing`, `hasSticker`,
  `isDuplicate`, `hasDuplicates` o `duplicateQuantity`.

Estados derivados:

```ts
const owned = quantity >= 1;
const missing = quantity === 0;
const duplicateQuantity = Math.max(quantity - 1, 0);
const hasDuplicates = duplicateQuantity > 0;
```

El progreso usa figuritas únicas poseídas, nunca cantidad física total. Las
repetidas no aumentan el porcentaje.

Diferenciar siempre:

* códigos repetidos: cantidad de códigos con `quantity > 1`;
* copias repetidas: suma de `quantity - 1`, disponibles para cambiar.

## Persistencia

El MVP persiste en IndexedDB del navegador. La UI y el dominio no deben depender
directamente de IndexedDB; usar una abstracción simple:

```ts
interface CollectionRepository {
  getAll(): Promise<CollectionEntry[]>;
  getQuantity(stickerCode: string): Promise<number>;
  increment(stickerCode: string): Promise<void>;
  decrement(stickerCode: string): Promise<void>;
  setQuantity(stickerCode: string, quantity: number): Promise<void>;
  replaceAll(entries: CollectionEntry[]): Promise<void>;
  clear(): Promise<void>;
}
```

No crear un framework genérico de repositorios.

Reglas:

* Acceder a APIs del navegador solo client-side.
* No asumir IndexedDB durante SSR o tests.
* No persistir negativos, decimales ni códigos desconocidos.
* Al dejar cantidad en cero, se puede eliminar la entrada.
* Operaciones de múltiples registros deben ser transaccionales cuando sea viable.
* Preferir persistir antes de mostrar éxito durable; si hay actualización
  optimista, debe existir rollback.
* No asumir que una única pestaña es la única escritora.

## Backup

La app debe poder exportar e importar un respaldo técnico validado. Formato base:

```ts
type CollectionBackup = {
  version: 1;
  exportedAt: string;
  albumId: "panini-world-cup-2026";
  ownerName?: string;
  entries: CollectionEntry[];
};
```

Importar backups como datos no confiables:

* parsear JSON;
* validar estructura, `version` y `albumId`;
* normalizar y validar códigos contra el álbum;
* rechazar cantidades negativas, decimales o no numéricas;
* rechazar entradas duplicadas ambiguas;
* reemplazar de forma atómica, sin merge silencioso ni cambios parciales.

Nunca ejecutar contenido del archivo importado.

## Superficies MVP

Resumen:

* mostrar poseídas únicas, total `980`, porcentaje, faltantes, códigos
  repetidos, copias para cambiar y progreso visual;
* dar acceso rápido a entrada de figuritas, faltantes y repetidas.

Álbum:

* agrupar por sección, mostrar progreso por sección y grilla compacta;
* distinguir faltantes, poseídas y repetidas sin depender solo del color;
* permitir editar cantidad sin perder contexto;
* evitar botones permanentes `+`/`-` en cada celda si saturan mobile.

Entrada rápida:

* flujo principal para abrir paquetes;
* seleccionar sección y número, o ingresar código directo como método secundario;
* sumar una copia y persistir inmediatamente;
* mostrar feedback claro y permitir deshacer ingresos recientes;
* la lista temporal de ingresos recientes es historial visual, no transacción
  pendiente.

Repetidas:

* incluir solo `quantity > 1`;
* agrupar por sección, respetar orden del álbum, buscar y filtrar;
* mostrar copias para cambiar (`quantity - 1`), no cantidad total;
* copiar formato compacto, por ejemplo `ARG: 4x2, 11, 18x3`.

Faltantes:

* incluir todas las figuritas del álbum que no tengan una entrada persistida o
  cuya cantidad efectiva sea cero;
* agrupar por sección, respetar orden del álbum, buscar y filtrar;
* copiar formato compacto, por ejemplo `ARG: 3, 7, 15`.

Más/Ajustes:

* puede incluir propietario, respaldo, último respaldo, limpiar colección e
  información básica;
* toda acción destructiva requiere confirmación explícita.

Navegación sugerida:

```text
Resumen
Álbum
Repetidas
Más
```

La entrada rápida debe quedar siempre fácil de alcanzar. Evitar navegación
profunda y cuidar que el botón Atrás sea predecible.

## UI, accesibilidad y errores

* Diseñar mobile-first con targets táctiles grandes.
* Usar elementos semánticos, labels visibles, foco visible y navegación por
  teclado.
* Mantener contraste suficiente y no comunicar estado solo con color.
* Mostrar carga, feedback inmediato y errores accionables.
* Evitar animación o decoración que retrase tareas frecuentes.

Mensajes visibles deben ser claros, por ejemplo:

```text
El código ARG21 no existe en este álbum.
No se pudo abrir el respaldo.
El archivo no corresponde a este álbum.
No fue posible guardar el cambio.
```

No exponer excepciones crudas, stack traces ni detalles internos de IndexedDB.
Ante fallas de persistencia, conservar el estado anterior cuando sea posible,
no mostrar éxito definitivo y ofrecer reintento.

## Estado y código

* Preferir React state, hooks, context acotado y funciones puras.
* No introducir Redux, Zustand o query/cache tooling salvo necesidad demostrada.
* Mantener cálculos de dominio fuera de componentes visuales.
* Usar TypeScript con tipos explícitos, nombres descriptivos y módulos pequeños.
* No agregar abstracciones genéricas sin al menos una necesidad concreta.

Funciones de dominio esperadas cuando apliquen:

```ts
getUniqueOwnedCount(entries);
getMissingCount(entries, album);
getDuplicateCodeCount(entries);
getDuplicateCopyCount(entries);
getSectionProgress(section, entries);
formatDuplicateList(entries, album);
formatMissingList(entries, album);
validateStickerCode(code, album);
```

## PWA

La PWA se implementa después de estabilizar el núcleo de la app.

Alcance inicial:

* manifest válido;
* iconos;
* `name: "Álbum de Pedro"`;
* `short_name: "Figuritas"`;
* modo `standalone`;
* caché mínima, explícita y compatible con la versión actual de Next.js;
* acceso offline a superficies principales después de una primera carga.

No agregar push, background sync, periodic sync, prompts personalizados de
instalación, cuentas ni sincronización remota.

Al cambiar service worker, verificar instalación, modo standalone, uso offline,
actualización de versión y eliminación de cachés obsoletos.

## Testing

Priorizar dominio, integridad de datos, persistencia, importación y flujos
críticos. Cubrir, como mínimo:

* generación del álbum: 980 códigos, unicidad, secciones confirmadas, exclusión
  de promocionales y orden estable;
* cantidades: incremento, decremento sin negativos, cero faltante, uno poseída,
  repetidas como `quantity - 1`;
* estadísticas: poseídas únicas, faltantes, códigos repetidos, copias repetidas,
  progreso global y por sección;
* validación/importación/exportación: JSON malformado, versión, `albumId`,
  estructura, códigos desconocidos, cantidades inválidas, duplicados ambiguos y
  reemplazo atómico;
* listas: agrupación, orden, formato de faltantes/repetidas, filtros y búsqueda;
* UI crítica: agregar, repetir, deshacer, editar cantidad, copiar listas,
  importar respaldo y confirmar acciones destructivas.

Evitar tests frágiles atados a clases CSS, HTML accidental o nombres internos.

## Rendimiento y privacidad

El álbum tiene 980 figuritas: evitar optimización prematura.

* No regenerar el álbum completo en cada render.
* No hacer una consulta IndexedDB por figurita renderizada.
* Cargar entradas en lote y derivar estadísticas con funciones claras.
* No agregar virtualización o paginación sin problema medido.

No recopilar contraseñas, ubicación precisa, contactos, analytics asociados a un
menor, identificadores innecesarios ni información personal no requerida. No
agregar tracking, publicidad ni scripts externos innecesarios.

## Estructura

Adaptar a patrones reales; no forzar carpetas mecánicamente. Estructura posible:

```text
app/
components/
domain/
  album/
  collection/
persistence/
  indexed-db/
backup/
hooks/
```

## Workflow

Antes de cambiar código:

1. inspeccionar estructura, versión de Next.js, dependencias, estilos, tests y
   PWA existente;
2. definir objetivo exacto y archivos afectados;
3. confirmar que el cambio respeta el alcance del MVP.

Durante el cambio:

1. mantener alcance estrecho;
2. respetar patrones existentes;
3. evitar limpieza no relacionada;
4. agregar tests acordes al riesgo.

Después:

1. ejecutar validaciones relevantes (`lint`, tests, typecheck, build si aplica);
2. reportar cambios, lo que quedó fuera de alcance, limitaciones y chequeos
   manuales pendientes.

## Documentación

* `AGENTS.md` contiene reglas operativas permanentes; no usarlo como roadmap,
  especificación funcional ni bitácora.
* La definición del producto, el alcance y la planificación viven en `docs/`.
* Registrar decisiones técnicas o de producto solo cuando haya alternativas
  razonables, impacto futuro o no sean obvias leyendo el código.
* No documentar decisiones triviales ni duplicar contenido entre `AGENTS.md`,
  documentos y código.
* Cada incremento actualiza solo la documentación afectada por el cambio.
* Distinguir explícitamente entre decisiones confirmadas y preguntas abiertas.
* Describir el estado real del proyecto; no presentar trabajo planificado como
  si ya estuviera implementado.

## Orden recomendado del MVP

1. Definición del álbum.
2. Validación de códigos.
3. Cálculos de colección.
4. Persistencia IndexedDB.
5. Resumen.
6. Vista de álbum y edición de cantidades.
7. Entrada rápida.
8. Faltantes, repetidas y copiado de listas.
9. Backup y restauración.
10. Manifest, iconos, service worker y validación offline.

## Regla de decisión

Cuando existan varias opciones razonables, elegir la que sea más fácil para
Pedro, requiera menos infraestructura, proteja mejor los datos, mantenga el
dominio testeable y permita evolucionar sin reescribir la app.

No optimizar para demostrar tecnologías. Optimizar para resolver bien la gestión
del álbum.
