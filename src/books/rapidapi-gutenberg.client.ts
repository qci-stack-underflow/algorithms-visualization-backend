import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { SecretsService } from '../secrets/secrets.service';
import { BookInfo } from '../types/huffman.types';

export const RAPIDAPI_TIMEOUT_MS = 9_000;

interface RapidApiAuthor {
  name?: string;
}

interface RapidApiBookItem {
  id?: unknown;
  title?: unknown;
  authors?: unknown;
  languages?: unknown;
  formats?: unknown;
}

interface RapidApiSearchResponse {
  results?: unknown;
}

const LANGUAGE_LABELS: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  fr: 'Francés',
  de: 'Alemán',
  pt: 'Portugués',
  it: 'Italiano',
};

function hasUtf8PlainTextFormat(formats: unknown): boolean {
  if (!formats || typeof formats !== 'object' || Array.isArray(formats)) {
    return false;
  }

  for (const [mime, url] of Object.entries(
    formats as Record<string, unknown>,
  )) {
    if (typeof url !== 'string' || url.trim().length === 0) {
      continue;
    }
    const normalized = mime.toLowerCase().trim();
    if (
      normalized === 'text/plain; charset=utf-8' ||
      normalized === 'text/plain'
    ) {
      return true;
    }
  }

  return false;
}

function formatAuthors(authors: unknown): string {
  if (!Array.isArray(authors) || authors.length === 0) {
    return 'Desconocido';
  }

  const names = authors
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (entry && typeof entry === 'object' && 'name' in entry) {
        const name = (entry as RapidApiAuthor).name;
        return typeof name === 'string' ? name.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);

  return names.length > 0 ? names.join(', ') : 'Desconocido';
}

function formatLanguage(languages: unknown): string {
  if (!Array.isArray(languages) || languages.length === 0) {
    return 'Desconocido';
  }

  const first: unknown = languages[0];
  if (typeof first !== 'string' || first.trim().length === 0) {
    return 'Desconocido';
  }

  const code = first.trim().toLowerCase();
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

function extractCoverImage(formats: unknown): string | undefined {
  if (!formats || typeof formats !== 'object' || Array.isArray(formats)) {
    return undefined;
  }

  const cover = (formats as Record<string, unknown>)['image/jpeg'];
  return typeof cover === 'string' && cover.trim().length > 0
    ? cover.trim()
    : undefined;
}

@Injectable()
export class RapidApiGutenbergClient {
  private readonly timeoutMs = RAPIDAPI_TIMEOUT_MS;

  constructor(private readonly secrets: SecretsService) {}

  async searchBooks(query: string): Promise<BookInfo[]> {
    const apiKey = this.secrets.RAPID_API_KEY.trim();
    const apiHost = this.secrets.RAPID_API_HOST.trim();
    const apiUrl = this.secrets.RAPID_API_URL.trim();

    if (
      !apiKey ||
      apiKey === 'none' ||
      !apiHost ||
      apiHost === 'none' ||
      !apiUrl ||
      apiUrl === 'none'
    ) {
      throw new BadGatewayException(
        'El servicio de búsqueda de RapidAPI no está configurado.',
      );
    }

    let searchUrl: URL;
    try {
      searchUrl = new URL(apiUrl);
    } catch {
      throw new BadGatewayException(
        'La URL de RapidAPI configurada es inválida.',
      );
    }
    searchUrl.searchParams.set('search', query.trim());

    const controller = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': apiHost,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadGatewayException(
          `Error al consultar el catálogo de RapidAPI (HTTP ${response.status}).`,
        );
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new BadGatewayException(
          'Respuesta JSON inválida del servicio de búsqueda de RapidAPI.',
        );
      }

      return this.mapResponseToBookInfo(payload);
    } catch (error: unknown) {
      if (
        error instanceof BadGatewayException ||
        error instanceof GatewayTimeoutException
      ) {
        throw error;
      }

      const err = error as { name?: string; code?: string };
      if (
        timedOut ||
        err?.name === 'AbortError' ||
        err?.name === 'TimeoutError' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNABORTED'
      ) {
        throw new GatewayTimeoutException(
          'El servicio de búsqueda de RapidAPI no respondió a tiempo.',
        );
      }

      throw new BadGatewayException(
        'Error al conectar con el servicio de búsqueda de RapidAPI.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private mapResponseToBookInfo(payload: unknown): BookInfo[] {
    const rawItems: unknown[] = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === 'object' &&
          Array.isArray((payload as RapidApiSearchResponse).results)
        ? ((payload as RapidApiSearchResponse).results as unknown[])
        : [];

    const books: BookInfo[] = [];

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== 'object') {
        continue;
      }

      const item = rawItem as RapidApiBookItem;
      if (
        typeof item.id !== 'number' ||
        !Number.isInteger(item.id) ||
        item.id <= 0
      ) {
        continue;
      }

      if (typeof item.title !== 'string' || item.title.trim().length === 0) {
        continue;
      }

      if (!hasUtf8PlainTextFormat(item.formats)) {
        continue;
      }

      const coverImage = extractCoverImage(item.formats);

      books.push({
        type: 'gutenberg',
        id: item.id,
        title: item.title.trim(),
        author: formatAuthors(item.authors),
        language: formatLanguage(item.languages),
        size: 'Desconocido',
        ...(coverImage ? { coverImage } : {}),
      });
    }

    return books;
  }
}
