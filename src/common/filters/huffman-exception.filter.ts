import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HuffmanExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor.';
    let errorType = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse() as
        | string
        | { message?: string | string[] };
      const rawMessage =
        typeof responseBody === 'string'
          ? responseBody
          : Array.isArray(responseBody?.message)
            ? responseBody.message.join(', ')
            : responseBody?.message || exception.message;
      message = rawMessage;
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'status' in exception &&
      typeof (exception as { status: unknown }).status === 'number'
    ) {
      status = (exception as { status: number }).status;
      message =
        'message' in exception &&
        typeof (exception as { message: unknown }).message === 'string'
          ? (exception as { message: string }).message
          : message;
    }

    if (status === HttpStatus.REQUEST_TIMEOUT) {
      status = HttpStatus.GATEWAY_TIMEOUT;
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        errorType = 'Bad Request';
        break;
      case HttpStatus.NOT_FOUND:
        errorType = 'Not Found';
        if (!message || message === 'Not Found') {
          message = 'El libro solicitado no existe.';
        }
        break;
      case HttpStatus.PAYLOAD_TOO_LARGE:
        errorType = 'Payload Too Large';
        break;
      case HttpStatus.GATEWAY_TIMEOUT:
        errorType = 'Gateway Timeout';
        break;
    }

    response
      .setHeader?.('Content-Type', 'application/json; charset=utf-8');
    response.status(status).json({
      statusCode: status,
      error: errorType,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
