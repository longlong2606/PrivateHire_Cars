# 🚀 PRIVATEHIRE CARS - SPRINT 1 IMPLEMENTATION

> **📌 SPRINT SCOPE / GOAL:**  
> *"Set up the local frontend/backend project and database connection. Create the account schema and registration endpoint, validate required fields and unique email addresses, hash passwords, and store the selected mock-card reference with masked display."*

Dự án phát triển ứng dụng quản lý đăng ký xe theo mô hình Scrum/Agile, hoàn thiện **100% chính xác theo đúng phạm vi Scope** được giao.

---

## 📋 BẢNG ĐỐI CHIẾU CHI TIẾT THEO TỪNG MỤC CỦA SCOPE

| # | Yêu cầu trong Scope | Vị trí cài đặt trong mã nguồn | Trạng thái thực tế |
| :-: | :--- | :--- | :---: |
| **1** | **Set up local frontend/backend project & database connection** | * **Frontend:** Port 5173 (`frontend/`)<br>* **Backend:** Port 5000 (`backend/src/server.js`)<br>* **Database:** PostgreSQL Pool (`backend/src/config/db.js`) | ✅ **HOÀN THÀNH**<br>Chạy 1-click qua `run-all.bat` |
| **2** | **Create account schema & registration endpoint** | * **Schema:** Bảng `accounts` (`backend/src/database/schema.sql`)<br>* **Endpoint:** `POST /api/accounts/register` (`backend/src/routes/accountRoutes.js`) | ✅ **HOÀN THÀNH**<br>Tự động đồng bộ bảng khi khởi động |
| **3** | **Validate required fields & unique email addresses** | * Kiểm tra đủ 6 trường bắt buộc (`accountController.js:28-36`)<br>* Bắt lỗi email sai định dạng & chặn gõ sai tên miền<br>* Kiểm tra trùng lặp email (`AccountModel.findByEmail` & `UNIQUE (email)`) | ✅ **HOÀN THÀNH**<br>Validation 2 lớp cả Frontend & Backend |
| **4** | **Hash passwords** | * Băm mật khẩu bằng thư viện `bcryptjs` với salt 10 vòng (`accountController.js:88-89`)<br>* Mật khẩu lưu trong DB bắt đầu bằng `$2b$10$...` | ✅ **HOÀN THÀNH**<br>Tuyệt đối không lưu mật khẩu thô |
| **5** | **Store selected mock-card reference with masked display** | * Bảng `mock_cards` chứa 4 thẻ test cho sẵn<br>* Dropdown cho khách chọn thẻ dạng `•••• •••• •••• 4242 (Visa Test Card)`<br>* Lưu vào cột `mock_card_ref` của bảng `accounts` | ✅ **HOÀN THÀNH**<br>Không yêu cầu thẻ thật theo AC3 |

---

## 🏃 HƯỚNG DẪN KHỞI CHẠY VÀ KIỂM TRA DỰ ÁN

### 1. Khởi động ứng dụng Local (1-Click)
Nhấp đúp chuột vào file:
👉 **`run-all.bat`** (hoặc chạy lệnh `npm run dev`)
* **Giao diện Web:** [http://localhost:5173](http://localhost:5173) (Trang Đăng ký & Đăng nhập)
* **Backend REST API:** [http://localhost:5000/api](http://localhost:5000/api)

### 2. Kiểm tra Cơ sở dữ liệu (PostgreSQL / DataGrip)
Nhấp đúp chuột vào file:
👉 **`check-database.bat`** (hoặc chạy lệnh `npm run db:check`)
* Tự động in ra bảng 4 thẻ test và danh sách tất cả tài khoản đã băm mật khẩu BCrypt.

### 3. Làm sạch Database để test lại từ đầu
Nhấp đúp chuột vào file:
👉 **`clean-database.bat`** (hoặc chạy lệnh `npm run db:clean`)
* Xóa toàn bộ tài khoản, reset ID về số 1 để đăng ký lại từ đầu.

---

## 🛠️ CẤU TRÚC THƯ MỤC CHÍNH
```text
PrivateHire_Cars/
├── backend/
│   ├── src/
│   │   ├── config/db.js              # Kết nối PostgreSQL Pool
│   │   ├── controllers/accountController.js # Xử lý validate, băm BCrypt, đăng ký, đăng nhập
│   │   ├── database/schema.sql       # Cấu trúc bảng accounts & mock_cards
│   │   ├── models/accountModel.js    # Tương tác truy vấn SQL vào database
│   │   ├── routes/accountRoutes.js   # Endpoint POST /api/accounts/register
│   │   ├── services/emailService.js  # Dịch vụ gửi email xác nhận AC5
│   │   └── server.js                 # Máy chủ Express.js
│   ├── check-db.js                   # Script kiểm tra database tự động
│   └── clean-db.js                   # Script làm sạch database
├── frontend/
│   ├── index.html / register.html    # Form đăng ký khách hàng (AC1, AC2, AC3)
│   ├── login.html                    # Form đăng nhập chuẩn wireframe (AC4)
│   └── home.html                     # Trang chủ dashboard sau khi đăng nhập
├── run-all.bat                       # File khởi động nhanh cả hệ thống
├── check-database.bat                # File kiểm tra nhanh database
└── clean-database.bat                # File xóa nhanh database để test lại
```
