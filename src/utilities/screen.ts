export const wideScreenQuery = "(min-width: 821px) and (min-height: 521px)";

export function isWideScreen(): boolean {
  return globalThis.matchMedia?.(wideScreenQuery).matches ?? true;
}

export function watchWideScreen(onChange: (wide: boolean) => void): () => void {
  const media = globalThis.matchMedia?.(wideScreenQuery);
  if (!media) return () => undefined;
  const handle = (event: MediaQueryListEvent) => onChange(event.matches);
  media.addEventListener("change", handle);
  return () => media.removeEventListener("change", handle);
}
