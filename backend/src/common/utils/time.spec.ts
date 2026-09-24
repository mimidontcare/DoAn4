import { isWeekendInZone, toZoned } from './time';

const TZ = 'Asia/Ho_Chi_Minh';

describe('time', () => {
  it('quy đổi UTC sang giờ nghiệp vụ', () => {
    // 00:30 UTC = 07:30 giờ Việt Nam (UTC+7)
    const zoned = toZoned('2026-09-25T00:30:00Z', TZ);
    expect(zoned.hour()).toBe(7);
    expect(zoned.minute()).toBe(30);
  });

  it('xét cuối tuần theo giờ nghiệp vụ, không theo UTC', () => {
    // Thứ Sáu 2026-09-25 18:00 UTC = Thứ Bảy 2026-09-26 01:00 giờ Việt Nam
    expect(isWeekendInZone('2026-09-25T18:00:00Z', TZ)).toBe(true);
    // Thứ Sáu 2026-09-25 16:00 UTC = Thứ Sáu 23:00 giờ Việt Nam
    expect(isWeekendInZone('2026-09-25T16:00:00Z', TZ)).toBe(false);
  });

  it('ngày thường không phải cuối tuần', () => {
    // Thứ Tư 2026-09-23
    expect(isWeekendInZone('2026-09-23T05:00:00Z', TZ)).toBe(false);
  });
});
