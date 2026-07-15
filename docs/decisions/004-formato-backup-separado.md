# Formato de backup separado

## Estado

Aceptada.

## Contexto

El proyecto ya tiene un formato persistido interno en IndexedDB para la
colección activa. El Incremento 8A agrega exportación e importación manual de
archivos.

Un archivo de backup circula fuera del navegador, puede venir de otra versión de
la app y debe poder validarse antes de reemplazar la colección local.

## Decisión

El backup usa un contrato JSON propio, versionado y separado del registro
persistido en IndexedDB.

Formato inicial:

```ts
{
  type: "figus-pani-backup",
  formatVersion: 1,
  exportedAt: string,
  copiesByPosition: Record<string, number>
}
```

La restauración valida el contrato completo y, si es válido, reemplaza la
colección activa mediante `CollectionRepository.save()`.

## Alternativas consideradas

- Exportar directamente el registro IndexedDB.
- Usar el mismo formato lógico persistido como contrato externo.
- Crear un contrato de backup separado.

## Consecuencias

- Cambios internos de IndexedDB no quedan automáticamente expuestos como formato
  transportable.
- El backup puede incluir metadatos propios como `type` y `exportedAt`.
- La importación puede rechazar archivos que no correspondan a esta app antes de
  tocar la colección local.
- Hay que mantener validación y documentación específicas para el contrato de
  backup.
