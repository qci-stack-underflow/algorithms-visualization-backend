import {
  BadGatewayException,
  GatewayTimeoutException,
  INestApplication,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BOOKS_CATALOG } from '../src/books/books.catalog';
import { GutenbergClient } from '../src/books/gutenberg.client';
import { RapidApiGutenbergClient } from '../src/books/rapidapi-gutenberg.client';
import { readSuf } from '../src/huffman/utils/suf-format';
import {
  HuffmanNode,
  HuffmanResult,
  SUF_MAGIC,
} from '../src/types/huffman.types';

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
  let searchBooksMock: jest.Mock;

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
    searchBooksMock = jest.fn().mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GutenbergClient)
      .useValue({
        fetchBookText: fetchBookTextMock,
      })
      .overrideProvider(RapidApiGutenbergClient)
      .useValue({
        searchBooks: searchBooksMock,
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

    const { header: parsedSuf, decodedText: sufDecodedText } =
      readSuf(sufBuffer);
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
    const compressedData = sufBuffer.subarray(jsonResult.metrics.headerBytes);
    const decodedText = decodeBitstreamWithJsonTree(
      compressedData,
      parsedSuf.totalCharacters,
      jsonResult.nodes,
      jsonResult.rootId,
    );

    const expectedCleanText =
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme,\nno ha mucho tiempo que vivía un hidalgo de los de lanza en astillero.';
    expect(sufDecodedText).toBe(expectedCleanText);
    expect(decodedText).toBe(expectedCleanText);
  });

  it('valida los errores HTTP 400, 404, 413, 502 y 504 en los endpoints', async () => {
    // 400: ID no numérico o negativo
    await request(app.getHttpServer()).get('/huffman/books/abc').expect(400);

    await request(app.getHttpServer())
      .get('/huffman/books/-5/file')
      .expect(400);

    // 404: Libro inexistente en Project Gutenberg
    fetchBookTextMock.mockRejectedValueOnce(
      new NotFoundException('El libro con ID 999999 no existe.'),
    );
    await request(app.getHttpServer()).get('/huffman/books/999999').expect(404);

    // 502: Gutenberg no disponible y el libro no tiene respaldo local
    fetchBookTextMock.mockRejectedValueOnce(
      new BadGatewayException(
        'Project Gutenberg no está disponible (HTTP 503).',
      ),
    );
    await request(app.getHttpServer()).get('/huffman/books/1342').expect(502);

    // Con respaldo local, el mismo 503 de Gutenberg no es un error: se sirve
    // el libro completo desde assets/catalog-backup/.
    fetchBookTextMock.mockRejectedValueOnce(
      new BadGatewayException(
        'Project Gutenberg no está disponible (HTTP 503).',
      ),
    );
    const respaldo = await request(app.getHttpServer())
      .get('/huffman/books/2000')
      .expect(200);
    expect((respaldo.body as { totalCharacters: number }).totalCharacters).toBe(
      2110704,
    );

    // 413: Libro demasiado grande (> 4.5 MB)
    fetchBookTextMock.mockRejectedValueOnce(
      new PayloadTooLargeException(
        'El libro excede el límite máximo de 4.5 MB.',
      ),
    );
    const res413 = await request(app.getHttpServer())
      .get('/huffman/books/2000')
      .expect(413);
    expect((res413.body as { statusCode: number }).statusCode).toBe(413);

    // 504: Timeout de Gutenberg (> 10s)
    fetchBookTextMock.mockRejectedValueOnce(
      new GatewayTimeoutException('Project Gutenberg no respondió a tiempo.'),
    );
    const res504 = await request(app.getHttpServer())
      .get('/huffman/books/1342/file')
      .expect(504);
    expect((res504.body as { statusCode: number }).statusCode).toBe(504);
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

  it('POST /huffman/compress/file procesa un archivo .txt multipart y devuelve el stream binario combinado [uint32][JSON][.suf]', async () => {
    const customText =
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme.\nTexto subido por el usuario.';

    const uploadRes = await request(app.getHttpServer())
      .post('/huffman/compress/file')
      .field('title', 'Archivo Usuario')
      .attach('file', Buffer.from(customText, 'utf-8'), {
        filename: 'usuario.txt',
        contentType: 'text/plain',
      })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(uploadRes.headers['content-type']).toContain(
      'application/octet-stream',
    );
    expect(uploadRes.headers['content-disposition']).toContain('usuario.suf');

    const combinedBuffer = uploadRes.body as Buffer;
    expect(Buffer.isBuffer(combinedBuffer)).toBe(true);

    const jsonLength = combinedBuffer.readUInt32BE(0);
    const jsonBuffer = combinedBuffer.subarray(4, 4 + jsonLength);
    const sufBuffer = combinedBuffer.subarray(4 + jsonLength);

    const jsonResult = JSON.parse(
      jsonBuffer.toString('utf-8'),
    ) as HuffmanResult;
    expect(jsonResult.source.type).toBe('upload');
    expect(jsonResult.source.title).toBe('Archivo Usuario');
    expect(jsonResult.totalCharacters).toBe(customText.length);

    const { header: parsedSuf, decodedText } = readSuf(sufBuffer);
    expect(parsedSuf.magic).toBe(SUF_MAGIC);
    expect(parsedSuf.title).toBe('Archivo Usuario');
    expect(decodedText).toBe(customText);

    // 400 cuando no se adjunta archivo o no es .txt
    await request(app.getHttpServer())
      .post('/huffman/compress/file')
      .expect(400);

    await request(app.getHttpServer())
      .post('/huffman/compress/file')
      .attach('file', Buffer.from('no es txt'), {
        filename: 'imagen.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('POST /huffman/compress/file?metadata=false devuelve únicamente el binario .suf sin JSON', async () => {
    const customText = '  Texto crudo con espacios y salto final.\n';

    const uploadRes = await request(app.getHttpServer())
      .post('/huffman/compress/file?metadata=false')
      .field('title', 'Sin Metadata')
      .attach('file', Buffer.from(customText, 'utf-8'), {
        filename: 'raw.txt',
        contentType: 'text/plain',
      })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(uploadRes.headers['content-type']).toContain(
      'application/octet-stream',
    );
    expect(uploadRes.headers['content-disposition']).toContain('raw.suf');

    const sufBuffer = uploadRes.body as Buffer;
    expect(sufBuffer.subarray(0, 4).toString('ascii')).toBe(SUF_MAGIC);

    const { header, decodedText } = readSuf(sufBuffer);
    expect(header.title).toBe('Sin Metadata');
    expect(decodedText).toBe(customText);

    await request(app.getHttpServer())
      .post('/huffman/compress/file?metadata=maybe')
      .attach('file', Buffer.from(customText, 'utf-8'), {
        filename: 'raw.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('POST /huffman/decompress/file descomprime .suf puro (metadata=false por defecto) y combinado (metadata=true) a .txt', async () => {
    const customText =
      '  Prueba de ida y vuelta completo con emojis 🎉 y salto final.\n';

    // 1. Comprimir sin metadata -> .suf puro
    const rawSufRes = await request(app.getHttpServer())
      .post('/huffman/compress/file?metadata=false')
      .attach('file', Buffer.from(customText, 'utf-8'), {
        filename: 'roundtrip.txt',
        contentType: 'text/plain',
      })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    // 2. Descomprimir con default (metadata=false)
    const decodedPlainRes = await request(app.getHttpServer())
      .post('/huffman/decompress/file')
      .attach('file', rawSufRes.body as Buffer, {
        filename: 'roundtrip.suf',
        contentType: 'application/octet-stream',
      })
      .expect(200);

    expect(decodedPlainRes.headers['content-type']).toContain('text/plain');
    expect(decodedPlainRes.headers['content-disposition']).toContain(
      'roundtrip.txt',
    );
    expect(decodedPlainRes.text).toBe(customText);

    // 3. Comprimir con metadata=true -> [uint32][JSON][.suf]
    const combinedRes = await request(app.getHttpServer())
      .post('/huffman/compress/file?metadata=true')
      .attach('file', Buffer.from(customText, 'utf-8'), {
        filename: 'combined.txt',
        contentType: 'text/plain',
      })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    // 4. Descomprimir con metadata=true
    const decodedCombinedRes = await request(app.getHttpServer())
      .post('/huffman/decompress/file?metadata=true')
      .attach('file', combinedRes.body as Buffer, {
        filename: 'combined.suf',
        contentType: 'application/octet-stream',
      })
      .expect(200);

    expect(decodedCombinedRes.headers['content-disposition']).toContain(
      'combined.txt',
    );
    expect(decodedCombinedRes.text).toBe(customText);

    // 5. Errores 400: archivo faltante, .suf corrupto o metadata inválido
    await request(app.getHttpServer())
      .post('/huffman/decompress/file')
      .expect(400);

    await request(app.getHttpServer())
      .post('/huffman/decompress/file')
      .attach('file', Buffer.from('NO_ES_SUF'), {
        filename: 'corrupto.suf',
        contentType: 'application/octet-stream',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/huffman/decompress/file?metadata=invalid')
      .attach('file', rawSufRes.body as Buffer, {
        filename: 'roundtrip.suf',
        contentType: 'application/octet-stream',
      })
      .expect(400);
  });

  it('GET /huffman/books/search devuelve resultados de RapidAPI con Cache-Control y valida errores 400 y 502 (#60)', async () => {
    const mockResults = [
      {
        type: 'gutenberg',
        id: 2000,
        title: 'Don Quijote',
        author: 'Cervantes Saavedra, Miguel de',
        language: 'Español',
        size: 'Desconocido',
      },
    ];
    searchBooksMock.mockResolvedValueOnce(mockResults);

    const okRes = await request(app.getHttpServer())
      .get('/huffman/books/search?q=quijote')
      .expect(200);

    expect(okRes.headers['cache-control']).toContain('s-maxage=604800');
    expect(searchBooksMock).toHaveBeenCalledWith('quijote');
    expect(okRes.body).toEqual({ result: mockResults });

    // 400: q ausente o vacío
    await request(app.getHttpServer()).get('/huffman/books/search').expect(400);

    await request(app.getHttpServer())
      .get('/huffman/books/search?q=%20%20')
      .expect(400);

    // 502: fallo en RapidAPI
    searchBooksMock.mockRejectedValueOnce(
      new BadGatewayException('Error al consultar RapidAPI.'),
    );
    const res502 = await request(app.getHttpServer())
      .get('/huffman/books/search?q=cervantes')
      .expect(502);

    expect(res502.body).toMatchObject({
      statusCode: 502,
      error: 'Bad Gateway',
    });
  });
});
