import {
  GatewayTimeoutException,
  INestApplication,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BOOKS_CATALOG } from '../src/books/books.catalog';
import { GutenbergClient } from '../src/books/gutenberg.client';
import { HuffmanEngine } from '../src/huffman/huffman.engine';
import { HuffmanNode, HuffmanResult, SUF_MAGIC } from '../src/types/huffman.types';

function decodeBitstreamWithJsonTree(
  compressedData: Buffer,
  totalCharacters: number,
  nodes: HuffmanNode[],
  rootId: number,
): string {
  if (totalCharacters === 0) return '';
  const root = nodes[rootId];
  if (root.isLeaf) {
    return (root.symbol ?? '').repeat(totalCharacters);
  }

  const decodedChars: string[] = [];
  let currentNode = root;

  for (let byteIdx = 0; byteIdx < compressedData.length; byteIdx += 1) {
    const byte = compressedData[byteIdx];
    for (let bitPos = 7; bitPos >= 0; bitPos -= 1) {
      const bit = (byte >> bitPos) & 1;
      const nextId = bit === 0 ? currentNode.left : currentNode.right;
      if (nextId === null) {
        throw new Error('Árbol JSON inválido durante la decodificación');
      }
      currentNode = nodes[nextId];

      if (currentNode.isLeaf) {
        decodedChars.push(currentNode.symbol ?? '');
        if (decodedChars.length === totalCharacters) {
          return decodedChars.join('');
        }
        currentNode = root;
      }
    }
  }

  return decodedChars.join('');
}

describe('Huffman Endpoints (e2e - B8)', () => {
  let app: INestApplication<App>;
  let fetchBookTextMock: jest.Mock;

  const sampleGutenbergBook = [
    '\uFEFFThe Project Gutenberg eBook of Don Quijote',
    '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
    'En un lugar de la Mancha, de cuyo nombre no quiero acordarme,',
    'no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero.',
    '*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
    'End of Project Gutenberg License.',
  ].join('\r\n');

  beforeEach(async () => {
    fetchBookTextMock = jest.fn().mockResolvedValue(sampleGutenbergBook);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GutenbergClient)
      .useValue({
        fetchBookText: fetchBookTextMock,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      exposedHeaders: [
        'Content-Disposition',
        'Cache-Control',
        'Content-Length',
      ],
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /huffman/books devuelve el catálogo de libros con Cache-Control', async () => {
    const response = await request(app.getHttpServer())
      .get('/huffman/books')
      .expect(200);

    expect(response.headers['cache-control']).toContain('s-maxage=604800');
    expect(response.body).toEqual(BOOKS_CATALOG);
  });

  it('GET /huffman/books/:id devuelve el análisis JSON de compresión Huffman', async () => {
    const response = await request(app.getHttpServer())
      .get('/huffman/books/2000')
      .expect(200);

    const body = response.body as HuffmanResult;
    expect(fetchBookTextMock).toHaveBeenCalledWith(2000);
    expect(response.headers['cache-control']).toContain('max-age=86400');
    expect(body.source.id).toBe(2000);
    expect(body.source.title).toBe('Don Quijote');
    expect(body.distinctSymbols).toBeGreaterThan(10);
    expect(body.nodes.length).toBe(2 * body.distinctSymbols - 1);
    expect(body.steps.length).toBe(3 * body.distinctSymbols - 2);
  });

  it('GET /huffman/books/:id/file descarga el binario .suf y coincide exactamente con el árbol JSON', async () => {
    const jsonRes = await request(app.getHttpServer())
      .get('/huffman/books/2000')
      .expect(200);
    const jsonResult = jsonRes.body as HuffmanResult;

    const fileRes = await request(app.getHttpServer())
      .get('/huffman/books/2000/file')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(fileRes.headers['content-type']).toContain(
      'application/octet-stream',
    );
    expect(fileRes.headers['content-disposition']).toContain('book_2000.suf');
    expect(fileRes.headers['cache-control']).toContain('s-maxage=604800');

    const sufBuffer = fileRes.body as Buffer;
    expect(Buffer.isBuffer(sufBuffer)).toBe(true);
    expect(sufBuffer.byteLength).toBe(jsonResult.metrics.fileSizeBytes);

    const parsedSuf = HuffmanEngine.parseSufBuffer(sufBuffer);
    expect(parsedSuf.magic).toBe(SUF_MAGIC);
    expect(parsedSuf.title).toBe(jsonResult.source.title);
    expect(parsedSuf.totalCharacters).toBe(jsonResult.totalCharacters);
    expect(parsedSuf.symbolCount).toBe(jsonResult.distinctSymbols);
    expect(parsedSuf.paddingBits).toBe(jsonResult.metrics.paddingBits);

    // Verificar que cada entrada del diccionario binario coincida con las hojas del árbol JSON
    const jsonLeaves = jsonResult.nodes.slice(0, jsonResult.distinctSymbols);
    expect(parsedSuf.dictionary.length).toBe(jsonLeaves.length);

    parsedSuf.dictionary.forEach((entry, index) => {
      const leaf = jsonLeaves[index];
      expect(entry.symbol).toBe(leaf.symbol);
      expect(entry.frequency).toBe(leaf.weight);
      expect(entry.code).toBe(leaf.code);
      expect(entry.code).toBe(jsonResult.codes[entry.symbol]);
    });

    // Decodificar los bits del binario .suf usando el árbol JSON y comprobar que reconstruye el texto limpio
    const decodedText = decodeBitstreamWithJsonTree(
      parsedSuf.compressedData,
      parsedSuf.totalCharacters,
      jsonResult.nodes,
      jsonResult.rootId,
    );

    expect(decodedText).toBe(
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme,\nno ha mucho tiempo que vivía un hidalgo de los de lanza en astillero.',
    );
  });

  it('valida los errores HTTP 400, 404, 413 y 504 en los endpoints', async () => {
    // 400: ID no numérico o negativo
    await request(app.getHttpServer())
      .get('/huffman/books/abc')
      .expect(400);

    await request(app.getHttpServer())
      .get('/huffman/books/-5/file')
      .expect(400);

    // 404: Libro inexistente
    await request(app.getHttpServer())
      .get('/huffman/books/999999')
      .expect(404);

    // 413: Libro demasiado grande (> 4.5 MB)
    fetchBookTextMock.mockRejectedValueOnce(
      new PayloadTooLargeException('El libro excede el límite máximo de 4.5 MB.'),
    );
    const res413 = await request(app.getHttpServer())
      .get('/huffman/books/2000')
      .expect(413);
    expect(res413.body.statusCode).toBe(413);

    // 504: Timeout de Gutenberg (> 10s)
    fetchBookTextMock.mockRejectedValueOnce(
      new GatewayTimeoutException('Project Gutenberg no respondió a tiempo.'),
    );
    const res504 = await request(app.getHttpServer())
      .get('/huffman/books/2000/file')
      .expect(504);
    expect(res504.body.statusCode).toBe(504);
  });

  it('verifica las cabeceras CORS y preflight OPTIONS para despliegue en Vercel (B9)', async () => {
    const getRes = await request(app.getHttpServer())
      .get('/huffman/books')
      .set('Origin', 'https://stack-underflow-frontend-algviz.vercel.app')
      .expect(200);

    expect(getRes.headers['access-control-allow-origin']).toBe('*');
    expect(getRes.headers['access-control-expose-headers']).toContain(
      'Content-Disposition',
    );

    const optionsRes = await request(app.getHttpServer())
      .options('/huffman/books/2000/file')
      .set('Origin', 'https://stack-underflow-frontend-algviz.vercel.app')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(optionsRes.headers['access-control-allow-origin']).toBe('*');
    expect(optionsRes.headers['access-control-allow-methods']).toContain('GET');
  });
});
