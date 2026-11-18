import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { SecretsService } from '../secrets/secrets.service';
import { RapidApiGutenbergClient } from './rapidapi-gutenberg.client';

function createSecretsMock(
  overrides: Partial<{
    RAPID_API_KEY: string;
    RAPID_API_HOST: string;
    RAPID_API_URL: string;
  }> = {},
): SecretsService {
  return {
    PORT: 3000,
    RAPID_API_KEY: overrides.RAPID_API_KEY ?? 'test-key',
    RAPID_API_HOST:
      overrides.RAPID_API_HOST ??
      'project-gutenberg-free-books-api1.p.rapidapi.com',
    RAPID_API_URL:
      overrides.RAPID_API_URL ??
      'https://project-gutenberg-free-books-api1.p.rapidapi.com/books',
  } as SecretsService;
}

describe('RapidApiGutenbergClient (#58)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lanza BadGatewayException si faltan las credenciales de RapidAPI', async () => {
    const client = new RapidApiGutenbergClient(
      createSecretsMock({ RAPID_API_KEY: 'none' }),
    );

    await expect(client.searchBooks('quijote')).rejects.toThrow(
      BadGatewayException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lanza BadGatewayException si RAPID_API_URL es inválida', async () => {
    const client = new RapidApiGutenbergClient(
      createSecretsMock({ RAPID_API_URL: 'not-a-valid-url' }),
    );

    await expect(client.searchBooks('quijote')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('consulta RapidAPI, filtra libros sin texto plano UTF-8 y mapea a BookInfo[]', async () => {
    const client = new RapidApiGutenbergClient(createSecretsMock());

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        count: 3,
        results: [
          {
            id: 2000,
            title: 'Don Quijote',
            authors: [{ name: 'Cervantes Saavedra, Miguel de' }],
            languages: ['es'],
            formats: {
              'text/plain; charset=utf-8':
                'https://www.gutenberg.org/ebooks/2000.txt.utf-8',
              'image/jpeg':
                'https://www.gutenberg.org/cache/epub/2000/pg2000.cover.medium.jpg',
            },
          },
          {
            id: 9999,
            title: 'Solo HTML',
            authors: [{ name: 'Autor Sin Txt' }],
            languages: ['en'],
            formats: {
              'text/html': 'https://www.gutenberg.org/ebooks/9999.html',
            },
          },
          {
            id: 1342,
            title: 'Pride and Prejudice',
            authors: [{ name: 'Austen, Jane' }],
            languages: ['en'],
            formats: {
              'text/plain': 'https://www.gutenberg.org/ebooks/1342.txt.utf-8',
            },
          },
        ],
      }),
    });

    const results = await client.searchBooks('  quijote  ');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://project-gutenberg-free-books-api1.p.rapidapi.com/books?search=quijote',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'x-rapidapi-key': 'test-key',
          'x-rapidapi-host': 'project-gutenberg-free-books-api1.p.rapidapi.com',
          Accept: 'application/json',
        },
      }),
    );

    expect(results).toEqual([
      {
        type: 'gutenberg',
        id: 2000,
        title: 'Don Quijote',
        author: 'Cervantes Saavedra, Miguel de',
        language: 'Español',
        size: 'Desconocido',
        coverImage:
          'https://www.gutenberg.org/cache/epub/2000/pg2000.cover.medium.jpg',
      },
      {
        type: 'gutenberg',
        id: 1342,
        title: 'Pride and Prejudice',
        author: 'Austen, Jane',
        language: 'Inglés',
        size: 'Desconocido',
      },
    ]);
  });

  it('lanza BadGatewayException cuando RapidAPI devuelve estado HTTP de error', async () => {
    const client = new RapidApiGutenbergClient(createSecretsMock());
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    await expect(client.searchBooks('quijote')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('lanza GatewayTimeoutException cuando RapidAPI excede el tiempo límite', async () => {
    const client = new RapidApiGutenbergClient(createSecretsMock());
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchSpy.mockRejectedValueOnce(abortError);

    await expect(client.searchBooks('quijote')).rejects.toThrow(
      GatewayTimeoutException,
    );
  });

  it('lanza BadGatewayException ante un error de red genérico', async () => {
    const client = new RapidApiGutenbergClient(createSecretsMock());
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(client.searchBooks('quijote')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
