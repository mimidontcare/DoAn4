# Design system — Frontend

Áp dụng cho mọi trang của `frontend/`. Nguồn: skill UI/UX Pro Max (nhóm *Home Services*, pattern *Trust & Authority + Conversion*), đã điều chỉnh font và màu CTA cho phù hợp dự án. Token nằm ở `frontend/src/index.css`.

## 1. Phong cách

- **Flat Design**: không gradient, bóng đổ tối thiểu, đường nét gọn.
- Chuyển động 150–200ms, chỉ đổi màu/độ mờ khi hover; tắt chuyển động khi người dùng bật `prefers-reduced-motion` (đã cấu hình trong `index.css`).
- Icon dùng `lucide-react` (SVG), không dùng emoji làm icon. Icon trang trí gắn `aria-hidden="true"`.
- Chỉ light mode ở giai đoạn hiện tại.

## 2. Màu

Component chỉ dùng token (`bg-primary`, `text-muted-foreground`…), không viết mã màu trực tiếp.

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `primary` / `primary-foreground` | `#1E40AF` / `#FFFFFF` | Nút chính, link, focus ring |
| `background` | `#EFF6FF` | Nền trang |
| `foreground` | `#1E3A8A` | Chữ chính |
| `card` | `#FFFFFF` | Nền card, header |
| `muted-foreground` | `#475569` | Chữ phụ, mô tả, gợi ý |
| `accent` / `secondary` | `#DBEAFE` / `#E9EEF6` | Nền hover, nhãn khu vực |
| `border` | `#BFDBFE` | Viền card, đường kẻ |
| `input` | `#8091AD` | Viền ô nhập |
| `destructive` | `#DC2626` | Lỗi |
| `cta` / `cta-foreground` | `#EA580C` / `#000000` | **Chỉ** nút đặt lịch (từ Phase 4) |

Tỉ lệ tương phản đã kiểm tra: chữ ≥ 4.5:1 (thấp nhất là `destructive` trên nền trắng, 4.83:1), viền ô nhập 3.2:1. Chữ trắng trên nền cam chỉ đạt 3.56:1 nên nút CTA dùng chữ đen.

## 3. Chữ

- Font **Be Vietnam Pro** (Google Fonts, có subset tiếng Việt), trọng số 400/500/600/700, nạp trong `frontend/index.html`.
- Cỡ chữ nội dung ≥ 16px trên mobile; tiêu đề trang dùng `h1`.

## 4. Form

- Label luôn hiển thị (`FormField`), không dùng placeholder thay label.
- Lỗi nằm ngay dưới field (`role="alert"`, `aria-invalid`, `aria-describedby`); kiểm tra khi rời ô (`mode: 'onTouched'`).
- Lỗi nghiệp vụ từ server (409, 422) gắn vào đúng field khi xác định được (`showServerError`), còn lại hiện toast `sonner`.
- Ô mật khẩu có nút hiện/ẩn (`PasswordInput`); không chặn dán; gắn đúng `autocomplete` (`email`, `current-password`, `new-password`, `tel`, `name`).
- Nút submit hiển thị trạng thái đang xử lý và bị khóa khi đang gửi.

## 5. Bố cục và tương tác

- Vùng bấm tối thiểu 44px (ô nhập, nút trong form dùng `h-11`).
- Focus ring luôn nhìn thấy khi dùng bàn phím.
- Responsive, không cuộn ngang ở 375px; kiểm tra thêm ở 768, 1024, 1440px.
- Header dùng chung (`AppHeader`): logo, nhãn khu vực, tên người dùng (ẩn dưới 768px), đăng xuất.

## 6. Checklist trước khi giao một trang

- [ ] Không emoji làm icon; icon trang trí có `aria-hidden`
- [ ] Phần tử bấm được có `cursor-pointer` và trạng thái hover
- [ ] Tương phản chữ ≥ 4.5:1
- [ ] Focus nhìn thấy khi dùng bàn phím
- [ ] Tôn trọng `prefers-reduced-motion`
- [ ] Không cuộn ngang ở 375px
