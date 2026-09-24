import { isVndAmount, roundToThousand } from './money';

describe('money', () => {
  describe('isVndAmount', () => {
    it('chấp nhận số nguyên không âm', () => {
      expect(isVndAmount(0)).toBe(true);
      expect(isVndAmount(3350000)).toBe(true);
    });

    it('từ chối số thực, số âm và kiểu khác số', () => {
      expect(isVndAmount(1500.5)).toBe(false);
      expect(isVndAmount(-1000)).toBe(false);
      expect(isVndAmount('1000')).toBe(false);
      expect(isVndAmount(NaN)).toBe(false);
    });
  });

  describe('roundToThousand', () => {
    it('làm tròn về bội 1.000đ', () => {
      expect(roundToThousand(3350000)).toBe(3350000);
      expect(roundToThousand(3349400)).toBe(3349000);
      expect(roundToThousand(3349500)).toBe(3350000);
    });

    it('ném lỗi khi số tiền không hợp lệ', () => {
      expect(() => roundToThousand(-1)).toThrow(RangeError);
      expect(() => roundToThousand(Infinity)).toThrow(RangeError);
    });
  });
});
