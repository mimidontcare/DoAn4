# Kịch bản demo

Dùng cho buổi bảo vệ. Khoảng 15–20 phút, đi theo vòng đời một đơn và dừng lại ở 4 điểm nhấn kỹ thuật (Master Plan mục 1).

## Chuẩn bị (trước buổi demo)

1. Database mới: `npx prisma migrate dev` → `npx prisma db seed` → `npm run seed:demo` (xem README). Thời gian trong dữ liệu demo tính theo lúc chạy, nên chạy seed trong ngày demo.
2. Trong `backend/.env` của máy demo: `AUTH_THROTTLE_LIMIT=50` để đăng nhập nhiều tài khoản liên tiếp không bị chặn.
3. Chạy backend (`npm run start:dev`) và frontend (`npm run dev`). Mở 3 cửa sổ trình duyệt ẩn danh: khách, quản trị, nhân viên. Cửa sổ nhân viên thu nhỏ bằng cỡ điện thoại.
4. Tài khoản quản trị là `SEED_ADMIN_EMAIL` trong `.env` (bị bắt đổi mật khẩu ở lần đầu; đổi trước buổi demo). Mọi tài khoản `@demo.local` dùng mật khẩu `SEED_DEMO_PASSWORD`.

| Vai | Tài khoản | Có sẵn |
| --- | --- | --- |
| Khách | `khach.lan@demo.local` | BKDEMO001 chờ phân công, BKDEMO002 đã xác nhận, BKDEMO004 đang có đề xuất điều chỉnh, BKDEMO006 đã đánh giá |
| Khách | `khach.minh@demo.local` | BKDEMO005 hoàn thành chưa đánh giá, BKDEMO007 đã hủy, 1 địa chỉ ngoài vùng phục vụ |
| Nhân viên | `nv.an@demo.local` | Trưởng nhóm BKDEMO002 |
| Nhân viên | `nv.cuong@demo.local` | Trưởng nhóm BKDEMO004 (đang làm) |
| Nhân viên | `nv.dung@demo.local` | Nghỉ cả ngày mai |

## 1. Khách đặt lịch — điểm nhấn 4: giá do server tính, snapshot

1. Khách vãng lai mở trang chủ → "Tổng vệ sinh nhà đang ở" → xem bảng giá và đánh giá (tên khách rút gọn).
2. Bấm "Đặt lịch" → bị chuyển đăng nhập (`khach.lan`) → quay lại đúng wizard.
3. Nhập 200 m² sàn → chọn địa chỉ → chọn ngày mai: giá, số người, thời lượng hiện ngay. Chọn một thứ Bảy để thấy phụ phí cuối tuần 10%.
4. Nói: giá client không được gửi lên; nếu admin đổi giá giữa lúc báo giá và lúc đặt, server trả 409 và wizard báo giá lại (`expectedTotal`).
5. Xác nhận → trang chi tiết đơn, lịch sử có dòng "Đặt lịch".
6. (`khach.minh`) Trang Địa chỉ: địa chỉ ngoài vùng hiện nhãn "Ngoài vùng phục vụ" và không chọn được khi đặt lịch (Z01).

## 2. Quản trị phân công — điểm nhấn 1 và 2: xếp lịch nhiều người, chống race condition

1. Quản trị đăng nhập → Tổng quan: doanh thu tháng, điểm trung bình, ô "Chờ phân công", "Quá giờ chưa check-in" (BKDEMO003).
2. Bấm "Chờ phân công" → mở BKDEMO001 → "Phân công": danh sách chỉ gồm người rảnh trong khu vực (Dung đang nghỉ nên không có).
3. Chọn người và trưởng nhóm → đơn sang "Đã xác nhận".
4. Nói về khóa: transaction khóa dòng nhân viên theo id tăng dần (`SELECT … FOR UPDATE`), kiểm tra trùng lịch lại (tính buffer 30 phút), cập nhật kèm `version`. Chứng minh bằng test: `npx jest --config ./test/jest-e2e.json assignments` (hai admin cùng phân công, phân công chéo không deadlock). Có thể mở `docs/uml/sequence-assignment.puml`.

## 3. Nhân viên thực hiện — điểm nhấn 3 và 4: state machine, giá tạm tính có điều chỉnh

1. Cửa sổ điện thoại, `nv.cuong` → Lịch làm việc → BKDEMO004 đang làm, có đề xuất 100 → 120 m² chờ khách.
2. Cửa sổ khách (`khach.lan`) → BKDEMO004 → khung đề xuất so sánh cũ/mới → "Chấp nhận điều chỉnh": tổng tiền tính lại.
3. Nói: tăng tối đa 30% phút công lúc đặt (A04), không cộng dồn qua nhiều lần; giá dùng đơn giá và mức tối thiểu đã snapshot.
4. `nv.cuong` → "Hoàn thành" → "Xác nhận đã thu tiền" (chuyển khoản).
5. Mở lịch sử đơn: mọi bước (phân công, check-in, điều chỉnh, hoàn thành, thu tiền) đều có dòng ghi. Có thể mở `docs/uml/state-booking.puml`.
6. (`nv.an`) BKDEMO002 → "Từ chối việc" với lý do → đơn về "Chờ phân công", admin thấy lại ở Tổng quan.

## 4. Sau dịch vụ

1. `khach.minh` → BKDEMO005 → đánh giá 4 sao. Gửi lần nữa không được (mỗi đơn 1 lần, trong 7 ngày).
2. Quản trị → Đánh giá → ẩn một đánh giá → trang dịch vụ không còn hiển thị, điểm trung bình đổi theo.
3. Quản trị → Ngày nghỉ: đã có một ngày "Bảo trì thiết bị"; khách chọn ngày đó trong wizard thì báo không phục vụ.
4. (Tùy thời gian) Khách đổi lịch BKDEMO002 sang giờ khác: nhóm còn rảnh thì giữ, không thì đơn về chờ phân công.

## Câu hỏi hay gặp

- **Hai khách cùng đặt giờ cuối cùng còn trống?** Kiểm tra mềm khi đặt (T05) trừ số người của đơn đang chờ; bảo đảm cứng ở bước phân công.
- **Sao không dùng WebSocket để báo trạng thái?** Ngoài phạm vi Đồ án 4 (mục 18); trang dùng TanStack Query tải lại khi thao tác.
- **Đơn sát giờ không ai nhận?** Job chạy 5 phút/lần tự hủy với lý do "không có nhân viên" (`scheduler.service.ts`).
