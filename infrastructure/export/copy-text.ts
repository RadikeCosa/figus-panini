export type CopyTextResult =
  | { status: "copied" }
  | { status: "manual"; text: string };

export async function copyText(text: string): Promise<CopyTextResult> {
  if (canUseClipboardApi()) {
    await navigator.clipboard.writeText(text);
    return { status: "copied" };
  }

  if (copyWithTextarea(text)) {
    return { status: "copied" };
  }

  return { status: "manual", text };
}

function canUseClipboardApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  );
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }

  const activeElement = document.activeElement;
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.append(textarea);

  try {
    textarea.focus();
    textarea.select();

    return document.execCommand("copy");
  } finally {
    textarea.remove();

    if (activeElement instanceof HTMLElement) {
      activeElement.focus();
    }
  }
}
