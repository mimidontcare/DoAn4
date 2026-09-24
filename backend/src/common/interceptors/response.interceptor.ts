import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: unknown[] | null;
}

/** Bọc mọi response thành công theo dạng { success, data, message, errors }. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => ({
        // Health trả 503 khi DB down nhưng vẫn đi qua interceptor, nên success theo mã HTTP.
        success: res.statusCode < 400,
        data: data ?? null,
        message: res.statusCode < 400 ? 'OK' : 'Error',
        errors: null,
      })),
    );
  }
}
