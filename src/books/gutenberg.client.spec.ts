import {
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  GUTENBERG_MAX_BYTES,
  GUTENBERG_USER_AGENT,
  GutenbergClient,
} from './gutenberg.client';

function createStreamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
      } else {
        controller.close();
      }
    },
  });
}

describe('GutenbergClient (B2)', () => {
  let client: GutenbergClient;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    client = new GutenbergClient();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('arma la URL únicamente mediante un ID entero positivo (prevención SSRF)', () => {
    expect(client.buildBookUrl(2000)).toBe(
      'https://www.gutenberg.org/cache/epub/2000/pg2000.txt',
    );

    expect(() => client.buildBookUrl(-1)).toThrow(BadRequestException);
    expect(() => client.buildBookUrl(0)).toThrow(BadRequestException);
    expect(() => client.buildBookUrl(12.34)).toThrow(BadRequestException);
    expect(() => client.buildBookUrl(Number.NaN)).toThrow(BadRequestException);
    expect(() =>
      client.buildBookUrl('http://169.254.169.254' as unknown as number),
    ).toThrow(BadRequestException);
  });

  it('descarga el libro enviando el User-Agent propio', async () => {
    const content = 'Contenido de prueba de Project Gutenberg';
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': String(content.length) }),
      body: createStreamFromChunks([Buffer.from(content, 'utf-8')]),
    } as Response);

    const result = await client.fetchBookText(11);

    expect(result).toBe(content);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.gutenberg.org/cache/epub/11/pg11.txt',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'User-Agent': GUTENBERG_USER_AGENT,
        }),
      }),
    );
  });

  it('aborta la descarga y lanza 413 si el stream supera el tamaño máximo (4.5 MB)', async () => {
    const oversizedChunk = Buffer.alloc(GUTENBERG_MAX_BYTES + 1024, 'a');
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: createStreamFromChunks([oversizedChunk]),
    } as Response);

    await expect(client.fetchBookText(2000)).rejects.toThrow(
      PayloadTooLargeException,
    );
  });

  it('lanza 504 GatewayTimeoutException cuando la petición excede los 10s', async () => {
    jest.useFakeTimers();

    fetchSpy.mockImplementation((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const promise = client.fetchBookText(84);
    jest.advanceTimersByTime(10_000);

    await expect(promise).rejects.toThrow(GatewayTimeoutException);
  });

  it('lanza 404 NotFoundException si Gutenberg responde con 404', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as Response);

    await expect(client.fetchBookText(99999)).rejects.toThrow(NotFoundException);
  });
});
