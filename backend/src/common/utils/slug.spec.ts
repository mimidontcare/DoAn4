import { SLUG_REGEX, slugify } from './slug';

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, đổi đ thành d, nối bằng gạch ngang', () => {
    expect(slugify('Vệ sinh sofa, nệm, rèm')).toBe('ve-sinh-sofa-nem-rem');
    expect(slugify('Tổng vệ sinh nhà ĐANG ở')).toBe('tong-ve-sinh-nha-dang-o');
  });

  it('bỏ ký tự đặc biệt ở hai đầu, kết quả khớp SLUG_REGEX', () => {
    const slug = slugify('  --Kính & cửa sổ (m²)!! ');
    expect(slug).toBe('kinh-cua-so-m');
    expect(slug).toMatch(SLUG_REGEX);
  });

  it('chuỗi không có chữ hoặc số → chuỗi rỗng', () => {
    expect(slugify('!!!')).toBe('');
  });
});
