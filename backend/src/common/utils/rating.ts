/** Điểm trung bình làm tròn 1 chữ số thập phân; null khi chưa có đánh giá. */
export function roundRating(average: number | null): number | null {
  return average === null ? null : Math.round(average * 10) / 10;
}
