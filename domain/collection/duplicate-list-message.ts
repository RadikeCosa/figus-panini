import type { DuplicateCollectionView } from "./collection-views";

export function formatDuplicateListMessage(view: DuplicateCollectionView): string {
  if (view.duplicateCopyCount === 0) {
    return "No tenemos figuritas repetidas para cambiar.";
  }

  const lines = ["Tengo estas figuritas repetidas para cambiar:", ""];
  let previousGroup: string | null = null;

  for (const section of view.sections) {
    if (section.group !== previousGroup) {
      if (section.group !== "Especiales") {
        if (lines.at(-1) !== "") {
          lines.push("");
        }

        lines.push(section.group);
      }

      previousGroup = section.group;
    }

    const positions = section.positions.map(({ position, duplicateCopies }) =>
      duplicateCopies === 1 ? position : `${position} (x${duplicateCopies})`,
    );

    lines.push(`${section.section}: ${positions.join(", ")}`);
  }

  return lines.join("\n");
}
