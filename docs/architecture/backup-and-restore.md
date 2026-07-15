# Backup y restauración

## Propósito

`/backup` permite exportar la colección local a un archivo JSON y restaurar un
archivo validado. Todo ocurre en el navegador; no se envían datos a servidores y
el flujo no depende de red.

## Formato interno y backup

El formato persistido interno vive en IndexedDB y es responsabilidad de
`infrastructure/persistence/indexeddb-collection-repository.ts`.

El formato de backup vive en `domain/backup/collection-backup.ts`. Es un
contrato externo, versionado y transportable. No debe tratarse como una copia
directa del registro IndexedDB.

## Contrato JSON

Formato vigente:

```json
{
  "type": "figus-pani-backup",
  "formatVersion": 1,
  "exportedAt": "2026-07-15T12:00:00.000Z",
  "copiesByPosition": {
    "Argentina|7": 2
  }
}
```

El backup no incluye las 980 posiciones completas, jugadores, imágenes,
metadatos de UI, navegación, historial ni figuritas promocionales.

## Validación

La validación es conservadora: cualquier inconsistencia invalida la restauración
completa.

Se rechaza:

- JSON malformado;
- raíz no objeto;
- tipo de archivo incorrecto;
- versión no soportada;
- fecha ausente o inválida;
- `copiesByPosition` ausente o no objeto;
- cantidades no numéricas, negativas o decimales;
- claves desconocidas;
- entradas corruptas.

La normalización usa el dominio de colección. Las cantidades `0` se omiten del
estado restaurado.

## Exportación

La UI carga la colección actual, construye un backup con
`createCollectionBackup`, serializa con `serializeCollectionBackup` y descarga un
archivo:

```text
figus-pani-backup-YYYY-MM-DD.json
```

La descarga usa APIs nativas (`Blob`, `URL.createObjectURL` y un enlace temporal)
sin dependencias externas.

## Importación

El usuario selecciona un `.json`. La UI lee el archivo como texto y lo entrega al
dominio de backup.

Antes de restaurar, la pantalla muestra:

- fecha del backup;
- figuritas únicas pegadas;
- faltantes;
- copias repetidas;
- copias físicas;
- posiciones con repetidas;
- comparación con la colección actual.

## Reemplazo completo

Restaurar reemplaza la colección activa completa mediante
`CollectionRepository.save()`.

No hay merge ni restauración parcial. Si el guardado falla, la vista previa se
conserva y la colección actual no se muestra como reemplazada.

## Límite de tamaño

La UI rechaza archivos mayores a `1 MB`. El tamaño esperado del backup disperso
es mucho menor; el límite evita leer archivos accidentalmente grandes.

## Privacidad

La exportación, validación y restauración ocurren localmente en el navegador. No
hay backend, telemetría ni analíticas.

## Funcionamiento offline

La ruta `/backup` forma parte del shell PWA cacheado. Después de una primera
visita online puede abrirse sin conexión.

Exportar offline:

- carga la colección desde IndexedDB;
- serializa JSON en memoria;
- descarga el archivo con APIs nativas del navegador.

Restaurar offline:

- lee el archivo seleccionado por el usuario;
- valida el contrato de backup en memoria;
- reemplaza la colección activa mediante `CollectionRepository.save()`.

El service worker no cachea archivos de backup ni datos de usuario.

## Trade-offs

Reemplazo completo frente a merge:
el reemplazo es predecible y fácil de validar. El costo es que no combina dos
colecciones.

JSON legible frente a formato binario:
JSON permite inspección y depuración simple. El costo es que no es el formato
más compacto posible.

Validación conservadora frente a recuperación parcial:
rechazar cualquier issue evita restauraciones ambiguas. El costo es que un
archivo parcialmente rescatable igual se rechaza.

Descarga nativa frente a librería:
usar APIs del navegador evita dependencias. El costo es un pequeño adaptador de
descarga en UI.

Vista previa explícita frente a restauración inmediata:
la comparación reduce reemplazos accidentales. El costo es un paso extra.

Formato de backup separado frente a reutilizar directamente IndexedDB:
se evita congelar detalles internos como contrato externo. El costo es mantener
dos contratos documentados.

## Fuera de alcance

No implementa:

- sincronización remota;
- merge entre respaldos;
- múltiples álbumes;
- historial de cambios.

## Relación con otros documentos

- [Persistencia local](persistence.md)
- [PWA y funcionamiento offline](pwa-and-offline.md)
- [UI y flujo de estado](ui-and-state-flow.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
- [Decisiones](../decisions/README.md)
