import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiResponse } from '../interceptors/response.interceptor';

/**
 * Exception filter toàn cục. Mã lỗi dùng chung: 400 validate · 401 · 403 · 404 ·
 * 409 (xung đột lịch/version) · 422 (vi phạm business rule).
 * Không đưa stack trace hay chi tiết lỗi nội bộ ra response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi hệ thống';
    let errors: unknown[] | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as { message?: string | string[] };
        if (Array.isArray(payload.message)) {
          // ValidationPipe trả danh sách lỗi theo field.
          message = 'Dữ liệu không hợp lệ';
          errors = payload.message;
        } else if (payload.message) {
          message = payload.message;
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unknown exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiResponse<null> = {
      success: false,
      data: null,
      message,
      errors,
    };
    res.status(status).json(body);
  }
}
