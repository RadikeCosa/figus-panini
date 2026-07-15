# Modelo de dominio vigente

## 1. Propósito

Este documento describe el dominio ya implementado para el MVP: la definición
canónica del álbum, las reglas puras de colección, las vistas derivadas y la
consulta rápida de posiciones.

El dominio resuelve tres problemas centrales:

- definir cuáles son las 980 posiciones válidas del álbum estándar;
- representar cuántas copias tiene Pedro de cada posición;
- derivar progreso, faltantes y repetidas sin depender de UI, navegador ni
  persistencia;
- interpretar una consulta textual de posición sin acoplarla a React ni a
  IndexedDB.

La implementación actual vive en `domain/album/canonical-album.ts` y
`domain/collection/collection.ts`, con validación en sus tests unitarios.

## 2. Límites del dominio

El dominio separa cuatro responsabilidades:

```text
Álbum canónico -> universo válido de posiciones
Colección      -> cantidades registradas por posición válida
Consulta       -> parsing y lectura de estado de una posición
Persistencia   -> guarda y recupera colección local
Interfaz       -> presenta estados y dispara operaciones
```

La definición canónica del álbum es estática y determina qué posiciones existen.
La colección es el estado mutable del usuario, expresado como datos puros. La
persistencia con IndexedDB guarda y recupera esa colección. La interfaz consume
estas reglas en vez de duplicarlas.

## 3. Álbum Canónico

El álbum canónico del MVP contiene exactamente 980 posiciones:

- una sección especial `PANINI` con la posición `00`;
- una sección especial `FWC` con posiciones `1` a `19`;
- 48 secciones de selecciones, cada una con posiciones `1` a `20`.

El total es:

```text
1 + 19 + (48 x 20) = 980
```

Las selecciones están agrupadas declarativamente en 12 grupos de 4. La función
`expandCanonicalAlbumPositions` expande esa definición a una lista plana de
posiciones con orden global consecutivo.

Cada posición expandida contiene:

- `section`: nombre canónico de la sección;
- `position`: número de posición dentro de la sección, como texto;
- `globalOrder`: orden de presentación global, consecutivo desde 1 hasta 980.

La definición no contiene nombres de jugadores, fotos, escudos, rareza,
metadatos editoriales, secciones promocionales ni figuritas de Coca-Cola.

## 4. Identidad De Una Posición

La identidad conceptual de una posición es:

```text
nombre canónico de sección + posición dentro de esa sección
```

Ejemplos del dataset vigente:

- `PANINI` + `00`;
- `FWC` + `1`;
- `México` + `1`;
- `Panamá` + `20`.

La clave técnica usada por colección es reversible:

```text
encodeURIComponent(section) + "|" + encodeURIComponent(position)
```

Esa clave permite guardar cantidades en un mapa sin introducir un ID adicional.
No hay por ahora `sectionId`, `slug`, `displayName` ni otro identificador
independiente porque la decisión aceptada es trabajar con identidad mínima.

Una vez que existan colecciones guardadas, los nombres canónicos de sección
deben permanecer estables. Cambiarlos requeriría una migración explícita porque
la colección persistida dependerá de esa identidad.

El orden de presentación no forma parte de la identidad. `globalOrder` sirve
para recorrer o listar el álbum en orden estable, pero una posición sigue siendo
la misma por su sección y posición.

## 5. Colección

La colección se representa de forma dispersa:

```text
copiesByPosition: { [claveDePosicion]: cantidad }
```

Una colección vacía es:

```text
{ copiesByPosition: {} }
```

No se almacenan entradas con cantidad cero. Una posición ausente en el mapa
equivale a cantidad `0` y, por lo tanto, a figurita faltante. Esto mantiene el
estado pequeño y evita persistir flags derivados.

La colección no redefine el álbum. Solo registra cantidades para posiciones que
ya existen en el dataset canónico. Las operaciones públicas devuelven nuevos
objetos de colección y no mutan la colección recibida.

## 6. Reglas De Negocio

Las reglas básicas por posición son:

```text
copies = 0  -> faltante
copies >= 1 -> pegada
duplicates = max(copies - 1, 0)
```

El progreso global se calcula como figuritas únicas poseídas sobre el total
canónico de 980 posiciones. Las copias repetidas no aumentan el porcentaje.

El progreso por sección calcula cuántas posiciones de esa sección tienen al
menos una copia y usa como total la cantidad de posiciones canónicas de la
sección.

Los totales distinguen:

- total físico: suma de todas las copias registradas;
- total único: cantidad de posiciones con `copies >= 1`;
- total de repetidas: suma de `max(copies - 1, 0)`.

Las listas de faltantes y repetidas se derivan recorriendo el álbum canónico en
orden global.

## 7. Consulta Rápida De Posiciones

La consulta rápida interpreta entradas de texto como:

- `Argentina 7`;
- `México 12`;
- `PANINI 00`;
- `FWC 4`;
- `Corea del Sur 18`.

El dominio normaliza el nombre de sección antes de comparar:

- elimina espacios iniciales y finales;
- colapsa varios espacios internos;
- ignora diferencias de mayúsculas;
- tolera entrada sin diacríticos cuando la coincidencia es inequívoca.

La resolución siempre devuelve el nombre canónico vigente de la sección. No se
agregan alias, abreviaturas, códigos FIFA ni nombres en inglés.

El parsing separa el último token como posición y el resto como sección. Los
errores normales de entrada se modelan como resultados discriminados, no como
excepciones:

- consulta vacía;
- número ausente;
- sección inexistente o ambigua;
- posición no numérica;
- posición fuera del rango canónico de la sección.

La validación de existencia se deriva del álbum canónico:

- `PANINI` admite únicamente `00`;
- `FWC` admite `1` a `19`;
- cada selección admite `1` a `20`.

Cuando la posición existe, el dominio devuelve su identidad canónica y el estado
en una `CollectionState`: cantidad total de copias, copias repetidas y estado
`missing`, `owned` o `duplicate`. Esta operación es de solo lectura y no guarda
ni modifica la colección.

La misma lógica se reutiliza en entrada rápida, donde la escritura queda
separada en una acción explícita posterior a la consulta.

## 8. Operaciones Disponibles

Las funciones públicas relevantes son:

- `expandCanonicalAlbumPositions`: expande la definición declarativa del álbum.
- `listCanonicalSections`: lista secciones canónicas para sugerencias o
  navegación.
- `makePositionKey`: genera una clave técnica reversible para una posición.
- `parsePositionKey`: recupera sección y posición desde una clave técnica.
- `normalizeSectionText`: normaliza texto de sección para búsqueda.
- `resolveCanonicalSection`: resuelve una sección canónica desde texto de
  entrada.
- `parsePositionQuery`: interpreta una consulta textual y devuelve un resultado
  discriminado.
- `validatePositionExists`: valida una posición contra la definición canónica.
- `getPositionCollectionStatus`: obtiene el estado de una posición dentro de una
  colección.
- `createEmptyCollection`: crea una colección vacía.
- `getCopies`: lee la cantidad de una posición válida.
- `setCopies`: fija una cantidad válida y elimina la entrada si es cero.
- `addCopy`: suma una copia a una posición válida.
- `removeCopy`: quita una copia sin bajar de cero.
- `isOwned`: indica si una posición tiene al menos una copia.
- `isMissing`: indica si una posición está ausente o tiene cantidad cero.
- `getDuplicateCopies`: calcula copias repetidas de una posición.
- `listMissingPositions`: lista faltantes en orden canónico.
- `listDuplicatePositions`: lista posiciones con repetidas en orden canónico.
- `getGlobalProgress`: calcula progreso global contra las 980 posiciones.
- `getSectionProgress`: calcula progreso para una sección existente.
- `getPhysicalCopyCount`: suma todas las copias físicas.
- `getUniqueOwnedCount`: cuenta posiciones únicas poseídas.
- `getDuplicateCopyCount`: suma copias repetidas.
- `normalizeCollection`: valida datos externos y devuelve colección normalizada
  con issues.

## 9. Validación Y Normalización

Las operaciones internas validan contra el álbum canónico. Una posición
desconocida no puede modificarse ni leerse como si fuera válida.

Las cantidades válidas son números enteros no negativos. Se rechazan cantidades
negativas, decimales y valores no numéricos.

`normalizeCollection` trata datos externos como no confiables y admite dos
formas de entrada:

- un objeto indexado por claves técnicas;
- un array de entradas con `section`, `position` y `copies`.

El resultado siempre tiene esta forma:

```text
{ collection, issues }
```

La colección resultante queda normalizada: solo contiene posiciones conocidas
con cantidades enteras positivas. Las cantidades cero se omiten. Las posiciones
desconocidas, cantidades inválidas, entradas mal formadas y duplicados de arrays
se reportan como issues.

En arrays, si aparece una posición duplicada, se conserva la primera entrada
válida procesada y la repetición se reporta como `duplicate-position`.

## 10. Errores

`CollectionDomainError` se lanza cuando una operación interna recibe datos que no
puede aceptar como estado válido:

- clave técnica con formato inválido o no decodificable;
- posición inexistente en el álbum canónico;
- cantidad explícita negativa, decimal o inválida;
- sección inexistente al pedir progreso por sección.

En cambio, `normalizeCollection` no lanza por datos externos inválidos. Devuelve
un reporte de `issues` y excluye esas entradas de la colección normalizada.

De la misma forma, `parsePositionQuery` y la resolución de secciones no lanzan
por errores normales de entrada del usuario. Devuelven estados explícitos para
que la UI muestre mensajes breves sin exponer detalles técnicos.

## 11. Invariantes

Los tests actuales comprueban estas invariantes:

- el álbum expandido tiene exactamente 980 posiciones;
- existen 48 selecciones organizadas en 12 grupos de 4;
- cada selección tiene posiciones `1` a `20` sin huecos;
- existe exactamente `PANINI-00`;
- existen `FWC-1` a `FWC-19` sin huecos;
- no hay identidades duplicadas;
- `globalOrder` es único y consecutivo de 1 a 980;
- las fronteras globales esperadas se mantienen: `PANINI-00`, `FWC-1`,
  `FWC-19`, `México-1` y `Panamá-20`;
- no se incluyen secciones promocionales como `Coca-Cola` o `CC`;
- la colección vacía no almacena ceros;
- las cantidades son enteras no negativas;
- quitar copias no baja de cero;
- fijar cantidad cero elimina la entrada;
- las operaciones no mutan la colección recibida;
- progreso, faltantes y repetidas se calculan contra el álbum canónico;
- las listas derivadas respetan el orden canónico;
- la normalización omite ceros, excluye inválidos y reporta issues.
- la consulta textual devuelve identidades canónicas;
- las secciones se comparan con normalización de espacios, mayúsculas y
  diacríticos;
- `PANINI`, `FWC` y selecciones validan sus rangos desde la definición canónica;
- el estado de consulta distingue faltante, pegada y repetida sin modificar la
  colección.

## 12. Trade-Offs

Dataset generado frente a 980 objetos manuales: la generación declarativa reduce
duplicación y hace visibles las reglas estructurales del álbum. El costo es que
la corrección depende de tests de expansión, conteo, orden y fronteras.

Mapa disperso frente a colección completa: el mapa guarda solo posiciones con
cantidad positiva y hace que la colección vacía sea mínima. El costo es que las
faltantes deben derivarse recorriendo el álbum canónico, no leyendo entradas
guardadas con cero.

Resolución exacta normalizada frente a búsqueda difusa: alcanza para el MVP y
evita dependencias o alias no confirmados. El costo es que el usuario debe
escribir el nombre canónico de la sección, aunque puede hacerlo sin respetar
mayúsculas, acentos ni espacios exactos.

Funciones puras frente a clases: las funciones puras facilitan tests, evitan
estado oculto y no dependen de navegador ni persistencia. El costo es que las
validaciones deben invocarse en cada operación pública relevante.

Clave técnica derivada frente a ID independiente: la clave reversible evita
mantener identificadores adicionales antes de necesitarlos. El costo es que los
nombres canónicos de sección quedan ligados a cualquier persistencia futura.

Rechazo en operaciones internas frente a normalización de datos externos: las
operaciones internas fallan temprano ante estados inválidos, mientras que la
normalización acumula issues para poder importar o revisar datos no confiables
sin producir cambios parciales silenciosos. El costo es mantener dos modos de
tratamiento: error para llamadas internas inválidas y reporte para entrada
externa.

## 12. Fuera De Alcance Del Dominio

El dominio no implementa:

- acceso directo a IndexedDB;
- detalles visuales de UI;
- service worker o Cache Storage;
- sincronización;
- historial completo de cambios;
- múltiples usuarios.

La persistencia, el backup, la UI y la PWA consumen las reglas del dominio, pero
mantienen sus responsabilidades en capas separadas.

## 13. Relación Con Otras Capas

La persistencia guarda y recupera la colección sin duplicar reglas de validez.
Antes de devolver datos externos usa las funciones de dominio para validar
posiciones, cantidades y normalizar datos.

La UI lee estados derivados desde el dominio: progreso, faltantes, repetidas,
total físico, total único y copias repetidas. No persiste flags como `owned`,
`missing` o `hasDuplicates`, porque ya se calculan desde `copies`.

La dirección arquitectónica vigente es:

```text
Datos guardados -> dominio puro -> estados derivados -> UI
```

## Enlaces

- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Decisión 001: Excluir figuritas promocionales](../decisions/001-excluir-figuritas-promocionales.md)
- [Decisión 002: Identidad mínima de posiciones](../decisions/002-identidad-minima-de-posiciones.md)
