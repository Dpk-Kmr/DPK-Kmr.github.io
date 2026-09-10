import type { Project } from '../types';
import { validateProject } from './project';

export const SHARE_PREFIX = '#home=';
const MAX_BYTES = 5_000_000;
const encode = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};
const decode = (text: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length > MAX_BYTES * 1.4)
    throw new Error('This project link is invalid or too large.');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
async function readLimited(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_BYTES)
        throw new Error('This shared project exceeds the 5 MB project limit.');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function createShareLink(
  project: Project,
  website: string,
): Promise<string> {
  const address = new URL(website);
  if (address.protocol !== 'https:' && address.protocol !== 'http:')
    throw new Error('Use an HTTP or HTTPS website address.');
  address.username = '';
  address.password = '';
  address.hash = '';
  const json = new TextEncoder().encode(
    JSON.stringify(validateProject(project)),
  );
  if (json.byteLength > MAX_BYTES)
    throw new Error('This project exceeds the 5 MB sharing limit.');
  const compressed = typeof CompressionStream !== 'undefined';
  const bytes = compressed
    ? await readLimited(
        new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')),
      )
    : json;
  address.hash = `home=${compressed ? 'gz' : 'json'}.${encode(bytes)}`;
  return address.href;
}

export async function readShareLink(link: string): Promise<Project | null> {
  const hash = link.startsWith('#') ? link : new URL(link).hash;
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  try {
    const [format, payload, extra] = hash.slice(SHARE_PREFIX.length).split('.');
    if (!payload || extra || !['gz', 'json'].includes(format))
      throw new Error('Unrecognized snapshot format.');
    let bytes: Uint8Array<ArrayBufferLike> = decode(payload);
    if (format === 'gz') {
      if (typeof DecompressionStream === 'undefined')
        throw new Error(
          'Use a current browser to open this compressed project link.',
        );
      bytes = await readLimited(
        new Blob([bytes as Uint8Array<ArrayBuffer>])
          .stream()
          .pipeThrough(new DecompressionStream('gzip')),
      );
    }
    if (bytes.byteLength > MAX_BYTES)
      throw new Error('This shared project exceeds the 5 MB project limit.');
    return validateProject(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    throw new Error(
      `The shared project could not be opened. ${error instanceof Error ? error.message : 'Check the complete link.'}`,
    );
  }
}
