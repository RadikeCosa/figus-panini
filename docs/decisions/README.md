# Decisiones

Esta carpeta sirve para registrar decisiones técnicas o de producto que merecen seguimiento porque tienen impacto futuro, resuelven alternativas razonables o no se entienden bien leyendo solo el código.

## Cuándo crear un registro

Crear una decisión propia cuando:

- hubo más de una opción razonable;
- la elección cambia el diseño, el flujo o el mantenimiento futuro;
- la decisión no es obvia sin contexto adicional;
- conviene conservar el motivo para referencias posteriores.

## Cuándo no crear uno

No crear un registro cuando:

- la decisión es trivial o puramente mecánica;
- el cambio ya queda claro en el código y en la documentación cercana;
- solo repetiría contenido de `AGENTS.md` o de la definición del producto;
- el asunto todavía está abierto y no hay una decisión real para documentar.

## Formato recomendado

Cada archivo debería incluir:

- título;
- estado;
- contexto;
- decisión;
- alternativas consideradas;
- consecuencias.

Estados recomendados:

- propuesta;
- aceptada;
- reemplazada;
- descartada.

## Convención de nombres

Usar nombres ordenados y estables, por ejemplo:

- `001-nombre-de-la-decision.md`;
- `002-otra-decision.md`.

## Índice

- [001. Excluir figuritas promocionales](001-excluir-figuritas-promocionales.md)
- [002. Identidad mínima de posiciones](002-identidad-minima-de-posiciones.md)
- [003. Formato persistido de colección local](003-formato-persistido-coleccion-local.md)
- [004. Formato de backup separado](004-formato-backup-separado.md)

## Relación con otros documentos

- [Definición del producto](../product/product-definition.md)
- [Alcance del MVP](../product/mvp-scope.md)
- [Roadmap de implementación](../planning/implementation-roadmap.md)
