const vnd = new Intl.NumberFormat('vi-VN')

/** Tiền là số nguyên VND: 350000 → "350.000đ". */
export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}đ`
}
