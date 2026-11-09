import {
  ArgumentsHost,
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
  PayloadTooLargeException,
  RequestTimeoutException,
} from '@nestjs/common';
import { HuffmanExceptionFilter } from './huffman-exception.filter';

describe('HuffmanExceptionFilter (B6)', () => {
  let filter: HuffmanExceptionFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let hostMock: ArgumentsHost;

  beforeEach(() => {
    filter = new HuffmanExceptionFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    hostMock = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('formatea errores 400 (ID inválido)', () => {
    filter.catch(new BadRequestException('ID inválido'), hostMock);
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'ID inválido',
      }),
    );
  });

  it('formatea errores 404 (Libro no existe)', () => {
    filter.catch(new NotFoundException('Libro no encontrado'), hostMock);
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Libro no encontrado',
      }),
    );
  });

  it('formatea errores 413 (Archivo muy grande)', () => {
    filter.catch(
      new PayloadTooLargeException('El libro excede el límite de 4.5 MB.'),
      hostMock,
    );
    expect(statusMock).toHaveBeenCalledWith(413);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'El libro excede el límite de 4.5 MB.',
      }),
    );
  });

  it('formatea errores 504 (Timeout de Gutenberg)', () => {
    filter.catch(
      new GatewayTimeoutException('Timeout al descargar de Gutenberg'),
      hostMock,
    );
    expect(statusMock).toHaveBeenCalledWith(504);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 504,
        error: 'Gateway Timeout',
        message: 'Timeout al descargar de Gutenberg',
      }),
    );
  });

  it('normaliza RequestTimeoutException (408) a 504 Gateway Timeout', () => {
    filter.catch(new RequestTimeoutException('Timeout'), hostMock);
    expect(statusMock).toHaveBeenCalledWith(504);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 504,
        error: 'Gateway Timeout',
      }),
    );
  });
});
