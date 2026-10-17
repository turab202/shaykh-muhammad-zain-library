export function storageKeyToUrl(key: string | undefined | null): string | undefined {
  if (!key) return undefined;
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("s3://")) {
    return `/api/media/b2/${key.split("/").slice(3).join("/")}`;
  }
  return `/api/media/${key}`;
}
