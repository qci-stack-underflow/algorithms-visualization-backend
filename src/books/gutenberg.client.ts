import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

export const GUTENBERG_TIMEOUT_MS = 10_000;
export const GUTENBERG_MAX_BYTES = 4.5 * 1024 * 1024; // 4.5 MB (límite de Vercel)
export const GUTENBERG_USER_AGENT =
  'HuffmanWebCompressor/1.0 (StackUnderflow Educational Project)';

@Injectable()
export class GutenbergClient {
  private readonly maxBytes = GUTENBERG_MAX_BYTES;
  private readonly timeoutMs = GUTENBERG_TIMEOUT_MS;
  private readonly userAgent = GUTENBERG_USER_AGENT;

  /**
   * Construye la URL de descarga exclusivamente a partir de un ID numérico
   * entero positivo para prevenir vulnerabilidades de SSRF.
   */
  buildBookUrl(bookId: number): string {
    if (
      typeof bookId !== 'number' ||
      !Number.isInteger(bookId) ||
      bookId <= 0
    ) {
      throw new BadRequestException(
        'El ID de Gutenberg debe ser un número entero positivo.',
      );
    }

    return `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;
  }

  async fetchBookText(bookId: number): Promise<string> {
    const url = this.buildBookUrl(bookId);
    const controller = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/plain; charset=utf-8',
        },
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new NotFoundException(
          `El libro con ID ${bookId} no existe en Project Gutenberg.`,
        );
      }

      if (!response.ok) {
        throw new BadRequestException(
          `Error al consultar Project Gutenberg (HTTP ${response.status}).`,
        );
      }

      const contentLengthHeader = response.headers?.get?.('content-length');
      if (contentLengthHeader) {
        const declaredBytes = Number(contentLengthHeader);
        if (Number.isFinite(declaredBytes) && declaredBytes > this.maxBytes) {
          controller.abort();
          throw new PayloadTooLargeException(
            'El libro excede el límite máximo de 4.5 MB.',
          );
        }
      }

      if (!response.body) {
        const text = await response.text();
        if (Buffer.byteLength(text, 'utf-8') > this.maxBytes) {
          throw new PayloadTooLargeException(
            'El libro excede el límite máximo de 4.5 MB.',
          );
        }
        return text;
      }

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          const chunk = Buffer.from(value);
          receivedBytes += chunk.byteLength;

          if (receivedBytes > this.maxBytes) {
            await reader.cancel().catch(() => undefined);
            controller.abort();
            throw new PayloadTooLargeException(
              'El libro excede el límite máximo de 4.5 MB.',
            );
          }

          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks).toString('utf-8');
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof PayloadTooLargeException ||
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
          'Project Gutenberg no respondió a tiempo (Timeout de 10s).',
        );
      }

      throw new BadRequestException('Error al contactar Project Gutenberg.');
    } finally {
      clearTimeout(timer);
    }
  }
}
