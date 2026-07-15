export const SELECTION_GROUPS = [
  {
    group: "Grupo A",
    sections: ["México", "Sudáfrica", "República de Corea", "Chequia"],
  },
  {
    group: "Grupo B",
    sections: ["Suiza", "Canadá", "Bosnia", "Qatar"],
  },
  {
    group: "Grupo C",
    sections: ["Brasil", "Marruecos", "Escocia", "Haití"],
  },
  {
    group: "Grupo D",
    sections: ["Estados Unidos", "Australia", "Paraguay", "Turquía"],
  },
  {
    group: "Grupo E",
    sections: ["Alemania", "Costa de Marfil", "Ecuador", "Curazao"],
  },
  {
    group: "Grupo F",
    sections: ["Países Bajos", "Japón", "Suecia", "Túnez"],
  },
  {
    group: "Grupo G",
    sections: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"],
  },
  {
    group: "Grupo H",
    sections: ["España", "Cabo Verde", "Uruguay", "Arabia Saudita"],
  },
  {
    group: "Grupo I",
    sections: ["Francia", "Noruega", "Senegal", "Irak"],
  },
  {
    group: "Grupo J",
    sections: ["Argentina", "Austria", "Argelia", "Jordania"],
  },
  {
    group: "Grupo K",
    sections: [
      "Colombia",
      "Portugal",
      "República Democrática del Congo",
      "Uzbekistán",
    ],
  },
  {
    group: "Grupo L",
    sections: ["Inglaterra", "Croacia", "Ghana", "Panamá"],
  },
] as const;

export const SELECTION_SECTIONS = SELECTION_GROUPS.flatMap(
  ({ sections }) => sections,
);

export const SPECIAL_SECTIONS = [
  { section: "PANINI", positions: ["00"] },
  {
    section: "FWC",
    positions: Array.from({ length: 19 }, (_, index) => String(index + 1)),
  },
] as const;

const SELECTION_POSITIONS = Array.from({ length: 20 }, (_, index) =>
  String(index + 1),
);

export function expandCanonicalAlbumPositions() {
  let globalOrder = 0;

  const specialPositions = SPECIAL_SECTIONS.flatMap(({ section, positions }) =>
    positions.map((position) => ({
      section,
      position,
      globalOrder: ++globalOrder,
    })),
  );

  const selectionPositions = SELECTION_SECTIONS.flatMap((section) =>
    SELECTION_POSITIONS.map((position) => ({
      section,
      position,
      globalOrder: ++globalOrder,
    })),
  );

  return [...specialPositions, ...selectionPositions];
}
