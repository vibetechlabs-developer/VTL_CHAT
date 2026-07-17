export const ALLOWED_FILE_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".zip",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.join(",");

export function validateFile(file) {
  if (!file) return null;

  const ext = file.name.includes(".")
    ? `.${file.name.split(".").pop().toLowerCase()}`
    : "";

  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    return `File type "${ext || "unknown"}" is not allowed. Allowed: ${ALLOWED_FILE_EXTENSIONS.join(", ")}`;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is 10 MB.`;
  }

  return null;
}
