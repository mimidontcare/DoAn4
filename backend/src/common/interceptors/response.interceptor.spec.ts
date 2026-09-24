import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

function contextWithStatus(statusCode: number) {
  return {
    switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
  } as unknown as ExecutionContext;
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor<unknown>();

  it('bọc dữ liệu theo dạng { success, data, message, errors }', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(200), {
        handle: () => of({ id: 1 }),
      }),
    );
    expect(result).toEqual({
      success: true,
      data: { id: 1 },
      message: 'OK',
      errors: null,
    });
  });

  it('data là null khi handler không trả gì', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(200), {
        handle: () => of(undefined),
      }),
    );
    expect(result.data).toBeNull();
  });

  it('success = false khi mã HTTP >= 400', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(503), { handle: () => of({}) }),
    );
    expect(result.success).toBe(false);
  });
});
