# 🚀 DỰ ÁN SCRUM - HOÀN THIỆN ĐẦY ĐỦ BƯỚC 1 ĐẾN BƯỚC 5

Dự án phát triển ứng dụng quản lý đăng ký theo mô hình Scrum/Agile, hoàn thiện trọn vẹn từ **Bước 1** đến **Bước 5** và thỏa mãn **100% cả 5 tiêu chí Acceptance Criteria (AC1 - AC5)**.

---

## 📋 ĐỐI CHIẾU 5 TIÊU CHÍ ACCEPTANCE CRITERIA

| Tiêu chí | Nội dung chi tiết | Trạng thái thực tế |
| :--- | :--- | :---: |
| **AC1** | Khách hàng có thể đăng ký tài khoản bằng: Tên, Email, Địa chỉ, Số điện thoại, Mật khẩu và Thẻ giả lập được chọn. | ✅ **Đã hoàn thành**: Form đăng ký với đầy đủ 7 ô nhập liệu. |
| **AC2** | Thiếu thông tin bắt buộc, email không đúng định dạng hoặc email đã đăng ký sẽ báo lỗi và chặn tạo tài khoản. | ✅ **Đã hoàn thành**: Kiểm tra validation cả Frontend và Backend, báo lỗi chi tiết từng trường. |
| **AC3** | Thông tin thẻ sử dụng danh sách thẻ test cho sẵn và hiển thị dưới dạng masked reference (không cần thẻ thật). | ✅ **Đã hoàn thành**: Dropdown hiển thị thẻ test dạng `•••• •••• •••• 4242 (Visa Test Card)`. |
| **AC4** | Đăng ký hợp lệ lưu tài khoản vào cơ sở dữ liệu để có thể dùng đăng nhập. | ✅ **Đã hoàn thành**: Mật khẩu băm bằng BCrypt, lưu vào DB và có form đăng nhập test ngay. |
| **AC5** | Sau khi đăng ký thành công, gửi email xác nhận đến địa chỉ email đã đăng ký. | ✅ **Đã hoàn thành**: Tự động tạo và gửi email xác nhận, hiển thị trực quan trên giao diện. |

---

## 🛠️ CHI TIẾT 5 BƯỚC CÔNG VIỆC

1. **Khởi tạo ứng dụng**: Setup Backend Express + Frontend React (Vite) + PostgreSQL.
2. **Kết nối database**: Kết nối PostgreSQL qua Pool, hỗ trợ fallback pg-mem cho nhóm chạy ngay.
3. **Tạo bảng tài khoản**: Bảng `accounts` (chứa mã tài khoản, tên, email, địa chỉ, điện thoại, mật khẩu băm, thẻ giả lập) và bảng `mock_cards`.
4. **Viết chức năng đăng ký ở backend**: Nhận dữ liệu từ form, kiểm tra hợp lệ, băm mật khẩu bằng BCrypt, sinh mã tài khoản duy nhất `ACC-XXXXXX`, lưu vào database và gửi email xác nhận.
5. **Kiểm tra dữ liệu đăng ký**: Bắt lỗi thiếu trường bắt buộc, kiểm tra định dạng email (Regex), kiểm tra trùng lặp email, kiểm tra khớp mật khẩu xác nhận, kiểm tra thẻ giả lập hợp lệ.

---

## 🏃 HƯỚNG DẪN KHỞI CHẠY CHO NHÓM

```bash
# 1. Cài đặt toàn bộ thư viện:
npm run install:all

# 2. Khởi động đồng thời cả Backend và Frontend:
npm run dev
```

* **Frontend:** [http://localhost:5173](http://localhost:5173) (Giao diện nền trắng, trực quan, dễ thao tác)
* **Backend API:** [http://localhost:5000](http://localhost:5000)
