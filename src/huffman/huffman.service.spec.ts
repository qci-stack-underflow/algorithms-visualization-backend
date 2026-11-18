import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GutenbergClient } from '../books/gutenberg.client';
import { LocalBackupService } from '../books/local-backup.service';
import { RapidApiGutenbergClient } from '../books/rapidapi-gutenberg.client';
import {
  HuffmanResult,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  SUF_MAGIC,
  VERCEL_MAX_PAYLOAD_BYTES,
} from '../types/huffman.types';
import { HuffmanService } from './huffman.service';

describe('HuffmanService (B5 & B7)', () => {
  let service: HuffmanService;
  let gutenbergClient: { fetchBookText: jest.Mock };
  let rapidApiClient: { searchBooks: jest.Mock };

  beforeEach(async () => {
    gutenbergClient = {
      fetchBookText: jest
        .fn()
        .mockResolvedValue(
          '*** START OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***\nEn un lugar de la Mancha, de cuyo nombre no quiero acordarme.\n*** END OF THE PROJECT GUTENBERG EBOOK DON QUIJOTE ***',
        ),
    };
    rapidApiClient = {
      searchBooks: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HuffmanService,
        { provide: GutenbergClient, useValue: gutenbergClient },
        { provide: LocalBackupService, useValue: new LocalBackupService() },
        { provide: RapidApiGutenbergClient, useValue: rapidApiClient },
      ],
    }).compile();

    service = module.get<HuffmanService>(HuffmanService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('procesa metadatos de Huffman y construye árbol, tabla, pasos y métricas', async () => {
    const result = await service.processHuffmanMetadata(2000);
    expect(result.source.title).toBe('Don Quijote');
    expect(result.distinctSymbols).toBeGreaterThan(5);
    expect(result.steps.length).toBe(3 * result.distinctSymbols - 2);
    expect(result.metrics.fileSizeBytes).toBe(
      result.metrics.headerBytes! + result.metrics.compressedBytes,
    );
  });

  it.each([
    ['503 de Gutenberg', new BadGatewayException('HTTP 503')],
    ['tiempo de espera', new GatewayTimeoutException('Timeout')],
    ['petición rechazada', new BadRequestException('Gutenberg IP blocked')],
  ])(
    'usa el libro completo del respaldo local (B4) ante un %s',
    async (_motivo, error) => {
      gutenbergClient.fetchBookText.mockRejectedValueOnce(error);

      const result = await service.processHuffmanMetadata(2000);
      expect(result.source.id).toBe(2000);
      // El respaldo es el libro completo: las cifras del reporte técnico.
      expect(result.totalCharacters).toBe(2110704);
      expect(result.distinctSymbols).toBe(92);
      expect(result.metrics.originalBytes).toBe(2168287);
      expect(result.metrics.fileSizeBytes).toBe(1166906);
    },
  );

  it('sin respaldo, responde el error de Gutenberg en lugar de inventar el libro', async () => {
    gutenbergClient.fetchBookText.mockRejectedValueOnce(
      new BadGatewayException('HTTP 503'),
    );
    await expect(service.processHuffmanMetadata(1342)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('genera el archivo binario .suf como Buffer (no string) menor a 4.5 MB (B7)', async () => {
    const { buffer } = await service.generateSufFile(2000);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(typeof (buffer as unknown)).not.toBe('string');
    expect(buffer.byteLength).toBeLessThan(VERCEL_MAX_PAYLOAD_BYTES);

    const { header: parsed } = service.decompressBinary(buffer);
    expect(parsed.magic).toBe(SUF_MAGIC);
    expect(parsed.title).toBe('Don Quijote');
    expect(parsed.dictionary.length).toBe(parsed.symbolCount);
  });

  it('lanza 413 PayloadTooLargeException si el binario .suf supera 4.5 MB (B7)', async () => {
    jest
      .spyOn(service, 'compressToBinary')
      .mockReturnValueOnce(Buffer.alloc(VERCEL_MAX_PAYLOAD_BYTES + 1));

    await expect(service.generateSufFile(2000)).rejects.toThrow(
      PayloadTooLargeException,
    );
  });

  it('comprime un libro de Gutenberg que no está en el catálogo (enlace)', async () => {
    gutenbergClient.fetchBookText.mockResolvedValueOnce(
      'The Project Gutenberg eBook of La Celestina\r\n\r\nTitle: La Celestina\r\nAuthor: Fernando de Rojas\r\nLanguage: Spanish\r\n\r\n*** START OF THE PROJECT GUTENBERG EBOOK LA CELESTINA ***\r\nCalisto y Melibea\r\n*** END OF THE PROJECT GUTENBERG EBOOK LA CELESTINA ***\r\n',
    );

    const result = await service.processHuffmanMetadata(1619);
    expect(gutenbergClient.fetchBookText).toHaveBeenCalledWith(1619);
    expect(result.source).toMatchObject({
      type: 'gutenberg',
      id: 1619,
      title: 'La Celestina',
      author: 'Fernando de Rojas',
      language: 'Español',
    });
    expect(result.totalCharacters).toBe('Calisto y Melibea'.length);
  });

  it('lanza NotFoundException si el libro no existe en Gutenberg', async () => {
    gutenbergClient.fetchBookText.mockRejectedValueOnce(
      new NotFoundException('No existe'),
    );
    await expect(service.processHuffmanMetadata(999999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rechaza con 400 un archivo que no está en UTF-8 (Latin-1)', () => {
    // "Canción" en Latin-1: la ó es el byte 0xF3.
    const latin1 = Buffer.from([0x43, 0x61, 0x6e, 0x63, 0x69, 0xf3, 0x6e]);
    expect(() =>
      service.compressUploadedFile({
        originalname: 'cancion.txt',
        mimetype: 'text/plain',
        size: latin1.length,
        buffer: latin1,
      }),
    ).toThrow(/UTF-8/);
  });

  it('conserva el BOM de un archivo subido (se comprime tal como llega)', () => {
    const conBom = Buffer.from('\uFEFFhola', 'utf-8');
    const { result } = service.compressUploadedFile({
      originalname: 'bom.txt',
      mimetype: 'text/plain',
      size: conBom.length,
      buffer: conBom,
    });
    expect(result.totalCharacters).toBe(5);
  });

  it('recorta a 200 caracteres el título de un archivo subido', () => {
    const texto = 'abc';
    const { result } = service.compressUploadedFile(
      {
        originalname: 'nota.txt',
        mimetype: 'text/plain',
        size: 3,
        buffer: Buffer.from(texto),
      },
      'ñ'.repeat(70_000),
    );
    expect(result.source.title).toBe('ñ'.repeat(200));
  });

  it('rechaza con 400, sin decodificarlo, un .suf que declara más caracteres de los que caben', () => {
    // Cabecera válida con un símbolo de código "0" y 1 MB de ceros: declara
    // 8 millones de caracteres. Antes se decodificaba completo en memoria.
    const datos = 1024 * 1024;
    const total = datos * 8;
    const cabecera = Buffer.alloc(21);
    let o = 0;
    o = cabecera.write('SUF1', o) + o;
    o = cabecera.writeUInt32BE(total, o);
    o = cabecera.writeUInt8(0, o);
    o = cabecera.writeUInt16BE(1, o);
    o = cabecera.writeUInt16BE(0, o);
    o = cabecera.writeUInt8(1, o);
    o = cabecera.write('a', o) + o;
    o = cabecera.writeUInt32BE(total, o);
    o = cabecera.writeUInt8(1, o);
    cabecera.write('0', o);
    const bomba = Buffer.concat([cabecera, Buffer.alloc(datos)]);

    const inicio = performance.now();
    expect(() =>
      service.decompressUploadedFile({
        originalname: 'bomba.suf',
        size: bomba.length,
        buffer: bomba,
      }),
    ).toThrow(/máximo/);
    expect(performance.now() - inicio).toBeLessThan(100);
  });

  it('should compress raw UTF-8 text and return analysis and SUF1 binary', () => {
    const text = 'Texto de prueba para el servicio de Huffman.';
    const output = service.compress(text, { title: 'Prueba Servicio' });

    expect(output.result).toBeDefined();
    expect(output.sufBuffer).toBeInstanceOf(Buffer);
    expect(output.result.totalCharacters).toBe(text.length);

    // Descomprimir binario con el servicio
    const decompressed = service.decompressBinary(output.sufBuffer);
    expect(decompressed.decodedText).toBe(text);
    expect(decompressed.header.title).toBe('Prueba Servicio');
  });

  it('should return HuffmanResult with compressToResult', () => {
    const text = 'Prueba corta';
    const result = service.compressToResult(text);
    expect(result.totalCharacters).toBe(text.length);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it('should return Buffer with compressToBinary', () => {
    const text = 'Prueba binaria';
    const binary = service.compressToBinary(text);
    expect(binary).toBeInstanceOf(Buffer);
    expect(binary.subarray(0, 4).toString('ascii')).toBe('SUF1');
  });

  it('should clean Gutenberg text via cleanText', () => {
    const raw =
      '\uFEFF*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nContenido real\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***';
    expect(service.cleanText(raw)).toBe('Contenido real');
  });

  it('procesa un archivo .txt subido por el cliente y genera el binario combinado [uint32][JSON][.suf]', () => {
    const text =
      'En un lugar de la Mancha, de cuyo nombre no quiero acordarme.';
    const output = service.compressUploadedFile(
      {
        originalname: 'mi-quijote.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(text, 'utf-8'),
        buffer: Buffer.from(text, 'utf-8'),
      },
      'Mi Quijote Personalizado',
    );

    expect(output.filename).toBe('mi-quijote.suf');
    expect(output.result.source.type).toBe('upload');
    expect(output.result.source.title).toBe('Mi Quijote Personalizado');
    if (output.result.source.type === 'upload') {
      expect(output.result.source.filename).toBe('mi-quijote.txt');
      expect(output.result.source.mimeType).toBe('text/plain');
    }

    const jsonLength = output.buffer.readUInt32BE(0);
    const jsonBytes = output.buffer.subarray(4, 4 + jsonLength);
    const sufBytes = output.buffer.subarray(4 + jsonLength);

    const parsedJson = JSON.parse(jsonBytes.toString('utf-8')) as HuffmanResult;
    expect(parsedJson.totalCharacters).toBe(text.length);
    expect(parsedJson.source.title).toBe('Mi Quijote Personalizado');

    const decompressed = service.decompressBinary(sufBytes);
    expect(decompressed.header.magic).toBe(SUF_MAGIC);
    expect(decompressed.decodedText).toBe(text);
  });

  it('devuelve únicamente el binario .suf (sin JSON) cuando includeMetadata es false', () => {
    const text = 'Solo archivo binario .suf sin metadatos JSON.';
    const output = service.compressUploadedFile(
      {
        originalname: 'solo-suf.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(text, 'utf-8'),
        buffer: Buffer.from(text, 'utf-8'),
      },
      'Solo SUF',
      false,
    );

    expect(output.buffer.equals(output.sufBuffer)).toBe(true);
    expect(output.buffer.subarray(0, 4).toString('ascii')).toBe(SUF_MAGIC);

    const decompressed = service.decompressBinary(output.buffer);
    expect(decompressed.header.title).toBe('Solo SUF');
    expect(decompressed.decodedText).toBe(text);
  });

  it('preserva saltos de línea y espacios iniciales/finales al comprimir un archivo subido', () => {
    const rawText = '  hola mundo\r\n';
    const output = service.compressUploadedFile({
      originalname: 'con-espacios.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength(rawText, 'utf-8'),
      buffer: Buffer.from(rawText, 'utf-8'),
    });

    const decompressed = service.decompressBinary(output.sufBuffer);
    expect(decompressed.decodedText).toBe(rawText);
    expect(output.result.totalCharacters).toBe(rawText.length);
  });

  it('lanza 400 o 413 cuando el archivo subido es inválido, vacío o supera los 4 MB', () => {
    expect(() => service.compressUploadedFile(undefined)).toThrow(
      BadRequestException,
    );

    expect(() =>
      service.compressUploadedFile({
        originalname: 'documento.pdf',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('contenido'),
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.compressUploadedFile({
        originalname: 'vacio.txt',
        mimetype: 'text/plain',
        size: 0,
        buffer: Buffer.from(''),
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.compressUploadedFile({
        originalname: 'grande.txt',
        mimetype: 'text/plain',
        size: MAX_UPLOAD_FILE_SIZE_BYTES + 1,
        buffer: Buffer.alloc(16, 65),
      }),
    ).toThrow(PayloadTooLargeException);
  });

  it('descomprime un archivo .suf puro (hasMetadata=false) y reconstruye el texto original', () => {
    const rawText = '  Texto con saltos\ny emojis 🚀 para descomprimir!\n';
    const compressed = service.compressUploadedFile(
      {
        originalname: 'entrada.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(rawText, 'utf-8'),
        buffer: Buffer.from(rawText, 'utf-8'),
      },
      'Entrada',
      false,
    );

    const decoded = service.decompressUploadedFile({
      originalname: 'entrada.suf',
      mimetype: 'application/octet-stream',
      size: compressed.buffer.byteLength,
      buffer: compressed.buffer,
    });

    expect(decoded.filename).toBe('entrada.txt');
    expect(decoded.decodedText).toBe(rawText);
    expect(decoded.buffer.toString('utf-8')).toBe(rawText);
  });

  it('descomprime un archivo combinado [uint32][JSON][.suf] cuando hasMetadata=true', () => {
    const rawText = 'Texto combinado con metadatos JSON.';
    const compressed = service.compressUploadedFile(
      {
        originalname: 'combinado.txt',
        mimetype: 'text/plain',
        size: Buffer.byteLength(rawText, 'utf-8'),
        buffer: Buffer.from(rawText, 'utf-8'),
      },
      'Combinado',
      true,
    );

    const decoded = service.decompressUploadedFile(
      {
        originalname: 'combinado.suf',
        mimetype: 'application/octet-stream',
        size: compressed.buffer.byteLength,
        buffer: compressed.buffer,
      },
      true,
    );

    expect(decoded.filename).toBe('combinado.txt');
    expect(decoded.decodedText).toBe(rawText);
  });

  it('lanza 400 o 413 al descomprimir un archivo .suf inválido, corrupto o demasiado grande', () => {
    expect(() => service.decompressUploadedFile(undefined)).toThrow(
      BadRequestException,
    );

    expect(() =>
      service.decompressUploadedFile({
        originalname: 'texto.txt',
        mimetype: 'text/plain',
        size: 4,
        buffer: Buffer.from('SUF1'),
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.decompressUploadedFile({
        originalname: 'malo.suf',
        mimetype: 'application/octet-stream',
        size: 12,
        buffer: Buffer.from('NOT_A_SUF_FILE'),
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      service.decompressUploadedFile(
        {
          originalname: 'mal-json.suf',
          mimetype: 'application/octet-stream',
          size: 12,
          buffer: Buffer.concat([
            Buffer.from([0, 0, 0, 4]),
            Buffer.from('{bad'),
            Buffer.from('SUF1'),
          ]),
        },
        true,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      service.decompressUploadedFile({
        originalname: 'grande.suf',
        mimetype: 'application/octet-stream',
        size: MAX_UPLOAD_FILE_SIZE_BYTES + 1,
        buffer: Buffer.from('SUF1'),
      }),
    ).toThrow(PayloadTooLargeException);
  });

  const libroRemoto = (id: number, title: string, author: string) => ({
    type: 'gutenberg' as const,
    id,
    title,
    author,
    language: 'Inglés',
    size: 'Desconocido',
  });

  it('busca en RapidAPI y retorna { result: BookInfo[] } con los que coinciden', async () => {
    rapidApiClient.searchBooks.mockResolvedValueOnce([
      libroRemoto(1342, 'Pride and Prejudice', 'Austen, Jane'),
      libroRemoto(946, 'Lady Susan', 'Austen, Jane'),
      libroRemoto(2701, 'Moby Dick; Or, The Whale', 'Melville, Herman'),
    ]);

    const response = await service.searchBooks('  jane austen  ');
    expect(rapidApiClient.searchBooks).toHaveBeenCalledWith('jane austen');
    // Pride and Prejudice está en el catálogo: va primero, con sus datos.
    expect(response.result.map((book) => book.id)).toEqual([1342, 946]);
    expect(response.result[0].author).toBe('Jane Austen');
  });

  it('descarta los libros que no coinciden (RapidAPI ignora la consulta, backend#62)', async () => {
    // Lo que responde RapidAPI en producción para cualquier consulta.
    rapidApiClient.searchBooks.mockResolvedValue([
      libroRemoto(1342, 'Pride and Prejudice', 'Austen, Jane'),
      libroRemoto(
        84,
        'Frankenstein; or, The modern Prometheus',
        'Shelley, Mary',
      ),
      libroRemoto(2701, 'Moby Dick; Or, The Whale', 'Melville, Herman'),
    ]);

    expect((await service.searchBooks('zzzzqq')).result).toEqual([]);
    expect(
      (await service.searchBooks('quijote')).result.map((book) => book.id),
    ).toEqual([2000]);
    expect(
      (await service.searchBooks('Pardo Bazán')).result.map((book) => book.id),
    ).toEqual([18005]);
    expect(
      (await service.searchBooks('frankenstein')).result.map((book) => book.id),
    ).toEqual([84]);
  });

  it('sin RapidAPI, responde los libros del catálogo que coinciden', async () => {
    rapidApiClient.searchBooks.mockRejectedValueOnce(
      new BadGatewayException('Error en RapidAPI'),
    );
    const response = await service.searchBooks('ulloa');
    expect(response.result.map((book) => book.id)).toEqual([18005]);
  });

  it('lanza BadRequestException en searchBooks cuando q falta o está vacío y propaga BadGatewayException', async () => {
    await expect(service.searchBooks(undefined)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.searchBooks('   ')).rejects.toThrow(
      BadRequestException,
    );

    // Sin coincidencias en el catálogo, el error de RapidAPI se propaga.
    rapidApiClient.searchBooks.mockRejectedValueOnce(
      new BadGatewayException('Error en RapidAPI'),
    );
    await expect(service.searchBooks('zzzzqq')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
