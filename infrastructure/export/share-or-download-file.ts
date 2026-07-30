export type ShareOrDownloadFileResult =
  | { status: "shared" }
  | { status: "canceled" }
  | { status: "downloaded" };

export type ShareOrDownloadFileOptions = {
  title: string;
  text: string;
};

export async function shareOrDownloadFile(
  file: File,
  options: ShareOrDownloadFileOptions,
): Promise<ShareOrDownloadFileResult> {
  if (canShareFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: options.title,
        text: options.text,
      });
      return { status: "shared" };
    } catch (error) {
      if (isAbortError(error)) {
        return { status: "canceled" };
      }

      throw error;
    }
  }

  downloadFile(file);
  return { status: "downloaded" };
}

function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = file.name;
  link.style.display = "none";
  document.body.append(link);

  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : isErrorWithName(error, "AbortError");
}

function isErrorWithName(error: unknown, name: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === name
  );
}
