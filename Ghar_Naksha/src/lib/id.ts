/** Keep local-network HTTP previews usable when randomUUID requires HTTPS. */
export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      '',
    );
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
