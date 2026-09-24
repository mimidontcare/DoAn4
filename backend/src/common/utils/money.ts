/** Tiền luôn là số nguyên VND, không dùng số thực. */
export function isVndAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Làm tròn về bội 1.000đ (gần nhất). Rule làm tròn giá được chốt lại ở Phase 4. */
export function roundToThousand(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('Số tiền không hợp lệ');
  }
  return Math.round(amount / 1000) * 1000;
}
