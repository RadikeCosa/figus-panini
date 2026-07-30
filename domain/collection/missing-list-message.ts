import type { MissingListDocument } from "./missing-list-document";

export function formatMissingListMessage(document: MissingListDocument): string {
  if (document.missingCount === 0) {
    return `¡Álbum completo! Ya tenemos las ${document.totalCount} figuritas.`;
  }

  const lines = ["Estas son las figuritas que nos faltan:", ""];
  let previousGroup: string | null = null;

  for (const section of document.sections) {
    if (section.group !== previousGroup) {
      if (section.group !== null) {
        if (lines.at(-1) !== "") {
          lines.push("");
        }

        lines.push(section.group);
      }

      previousGroup = section.group;
    }

    lines.push(`${section.section}: ${section.positions.join(", ")}`);
  }

  return lines.join("\n");
}
