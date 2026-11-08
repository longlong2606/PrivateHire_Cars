# Đặc tả triển khai website PrivateHire Cars cho Antigravity

Phiên bản ngày 8 November 2026. Nguồn chính: `6WHM.docx`, các mục 1.2, Table 3–Table 10, 3.2.2 P01–P09 và phần Sprint 1. Tài liệu này yêu cầu hoàn thiện một website chạy thực tế ở máy local với frontend, backend và PostgreSQL, bao phủ đủ 26 user stories và 140 acceptance criteria. Đây là đầu vào triển khai, không phải tuyên bố sản phẩm đã hoàn thành hoặc các kiểm thử đã đạt.

## 0. Hướng dẫn bắt đầu cho Antigravity

Đọc toàn bộ tài liệu này trước khi sửa code. Làm việc trong `PrivateHire_Cars-main`, kiểm tra trạng thái thực tế của mã nguồn rồi hoàn thiện các chức năng còn thiếu. Không dựng một ứng dụng mới tách rời, không chỉ tạo giao diện tĩnh hoặc dữ liệu giả ở frontend để thay cho nghiệp vụ backend/database.

Quy tắc làm việc bắt buộc theo yêu cầu của nhóm:

1. Giữ lại mã của các thành viên và chức năng đã có. Ưu tiên thêm file, module, trang và migration mới. Không ghi đè toàn bộ frontend/backend, không thay framework hoặc viết lại các file cũ cho tiện.
2. Trước khi cần sửa file cũ để nối route, xác thực, cập nhật điều hướng hoặc xử lý lỗi, nêu rõ file, thay đổi tối thiểu và lý do cho leader xem xét. Yêu cầu của nhóm hiện tại là không tự sửa code cũ. Nếu không thể hoàn thiện một AC mà không thay điểm tích hợp cũ, ghi rõ điểm chặn; không che giấu bằng cách làm giả hành vi ở UI.
3. Lập danh sách chức năng đã có, thiếu, chưa kiểm tra và chưa khớp AC. Đối chiếu code đang mở, không coi các đoạn báo cáo “successfully implemented” là bằng chứng code đã thực hiện đầy đủ.
4. Đọc AC, xác định dữ liệu và đầu ra cần dùng chung trước khi triển khai từng module. Tách route, service, truy cập dữ liệu và UI theo phạm vi hợp lý với dự án đang có; không ép kiến trúc lớn không cần thiết.
5. Tự thực hiện các bước đã được cho phép, chạy kiểm thử phù hợp và báo kết quả trung thực. Chỉ yêu cầu thông tin khi thiếu quyết định nghiệp vụ quan trọng hoặc gặp giới hạn không thể giải quyết trong phạm vi đã thống nhất.
6. Giữ nguyên các khóa `SCRUM-*` để truy vết. Story Points và MoSCoW là thông tin kế hoạch, không phải quy tắc chạy của ứng dụng và không được quy đổi cố định thành giờ.
7. Không đọc/in mật khẩu SMTP ra màn hình, không đưa bí mật vào commit, tài liệu, URL, response hoặc ảnh minh chứng. Cấu hình bí mật chỉ ở backend bằng biến môi trường/file cục bộ đã ignore.
8. Không tự tạo Work Log, cuộc họp, ngày hoàn thành, ảnh kiểm thử, cập nhật Done, lịch sử Jira hoặc kết quả Sprint thay cho nhóm. Việc sửa code theo tài liệu này không tự cấp quyền thay đổi Jira, gửi email trao đổi cho thành viên hay deploy.

Kết quả yêu cầu là toàn bộ website hoàn chỉnh theo mục 1–12 bên dưới; ưu tiên là thứ tự triển khai, không phải quyền bỏ các Should/Could khỏi sản phẩm cuối.

### 0.1 Thứ tự dùng nguồn khi có nội dung chưa thống nhất

1. AC tại Table 5 và P01–P09 trong báo cáo là chuẩn hành vi hiện tại.
2. Mục 1.2 và các điều chỉnh được mô tả rõ trong báo cáo xác định phạm vi nguyên mẫu.
3. Table 3 giữ yêu cầu case study gốc để truy vết; R6 gốc nhắc text nhưng chức năng hiện tại dùng thông báo web theo hướng dẫn thầy đã được ghi ở P04 và AC.
4. Các mô tả hình, đoạn kể tiến độ, wireframe và dữ liệu seed là tham khảo triển khai; không tự thêm chức năng vì một nút minh hoạ xuất hiện trong hình.
5. Các mục ghi **Đề xuất kỹ thuật** trong tài liệu này là cách hiện thực để đáp ứng AC, không phải yêu cầu nguyên văn CW. Có thể chọn cách tương đương nếu giữ đúng hành vi, độ nhất quán dữ liệu và việc bảo toàn mã của nhóm.

### 0.2 Những khác biệt đã nhận diện trong nguồn

| Nội dung | Cách xử lý khi triển khai |
|---|---|
| Đoạn dẫn 3.1.3 còn ghi tổng 86 điểm, trong khi 26 dòng Table 5 và mục 5.3 cho tổng 103 | Dùng 26 giá trị ở Table 5, tổng 103; không tự sửa Word/Jira trong công việc triển khai này |
| Table 3 R6 còn email/text preference; Table 7, AC SCRUM-14/15 và P04 đã đổi | Tự động gửi email xác nhận booking; thông báo xe gần đến lưu trong tài khoản web; không có SMS hay chọn kênh |
| Đoạn tiến độ SCRUM-47 dùng cụm “activation details” | Email là thông báo tạo tài khoản thành công. Không tự thêm OTP, activation link hoặc khóa tài khoản chờ xác minh |
| Wireframe sign-in có “Remember this device” và “Forgot password” | Chưa có AC cho password reset hoặc phiên đăng nhập dài hạn. Xem mục 10 trước khi bổ sung; không để nút hoạt động giả |
| Mục Sprint 1 chọn 9 US, trong khi SCRUM-29 cũng là Must và được dùng bởi giá/thanh toán | Có thể làm phần dùng chung và seed offer để tích hợp; không tự chuyển SCRUM-29 vào Sprint 1 hoặc sửa lịch sử Sprint |
| Report nêu 37 subtasks, nhưng bảng text 6.3 chỉ liệt kê 7 wireframe và một dòng tổng | Không suy ra 30 task còn lại từ dòng tổng. Dùng Jira hoặc tài liệu phân công khi cần; toàn bộ scope sản phẩm vẫn lấy từ 26 US |
| Giá mẫu và thời lượng cố định | Đây là dữ liệu nhóm chọn, không phải giá chính thức từ CW; không chuyển sang tính theo phút/km |
| Danh sách thẻ trong UI/seed có thể khác số cuối so với wireframe | Reuse catalogue backend hợp lệ. Bảo đảm Visa, Mastercard, American Express có mặt; không tự xóa lựa chọn JCB đang có nếu không cần |

## 1. Mục tiêu và giới hạn sản phẩm

### 1.1 Bài toán

PrivateHire Cars là doanh nghiệp private hire ở London. Quy trình đặt xe qua Call Centre quá tải và mất thời gian. Website cung cấp tự đặt xe cho khách và luồng staff hỗ trợ Telephone/In-person trên cùng dữ liệu, giúp kiểm tra giá, xe/tài xế và quản lý booking nhất quán.

### 1.2 Những gì cần xây dựng

- Website responsive cho desktop và trình duyệt điện thoại, với khu vực khách hàng và khu vực staff.
- Backend thực hiện xác thực, phân quyền, validation, tính giá, quản lý trạng thái và giao dịch dữ liệu.
- PostgreSQL lưu bền tài khoản, booking, xe, tài xế, thanh toán test, yêu cầu hoàn tiền, enquiry/reply, review, notification và offer.
- Real email cho bốn trường hợp: đăng ký tài khoản, xác nhận booking, staff trả lời enquiry, đề xuất offer.
- Card/PayPal/VISA Check, ghi nhận tiền mặt và hoàn tiền đều là giao dịch test trong nguyên mẫu. Không xử lý tiền thật.
- Đặt xe Online, Telephone và In-person; Online được giảm 15% với mọi phương thức thanh toán.
- Chỉnh sửa/hủy booking theo mốc ít nhất 24 giờ trước giờ đón hiện có.
- Demo tiến trình hành trình bằng các thao tác staff; không phải đợi đến giờ thực tế.
- Thông báo xe gần đến trong tài khoản web do staff nhấn nút, được lưu bền.

### 1.3 Phần ngoài phạm vi

- Không yêu cầu deploy, cloud hosting, tên miền hoặc app iOS/Android riêng.
- Không live GPS, định tuyến bản đồ, tra khoảng cách, tính giá theo quãng đường/phút thực tế hoặc tự đếm ngược ETA.
- Không SMS gateway; không tích hợp PayPal/bank/VISA Check thật; không xin hoặc lưu thẻ ngân hàng thật.
- Không tự thêm driver mobile app, tài xế tự nhận chuyến, ví điện tử, subscriptions, quản trị nhân sự lớn hoặc AI recommendation phức tạp.
- Không cần tích hợp Jira/Figma vào sản phẩm khách hàng. Jira phục vụ quản lý nhóm; Figma phục vụ thiết kế.

“Không lấy API ngoài” được hiểu là không cần các dịch vụ thanh toán/bản đồ/GPS bên thứ ba; backend API do nhóm tự xây vẫn cần thiết. Real email qua Gmail SMTP là ngoại lệ đã thống nhất và cần internet để gửi thư.

### 1.4 Vai trò và quyền

| Vai trò | Quyền trong sản phẩm |
|---|---|
| Guest/Visitor | Xem giới thiệu dịch vụ, đăng ký, đăng nhập, gửi general enquiry; không gửi booking Online hoặc xem dữ liệu riêng |
| Customer | Quản lý profile của chính mình; tạo/xem booking; thanh toán hoặc chọn cash; sửa/hủy khi đủ điều kiện; xem receipt/refund/notification/offer của mình; trip enquiry và review hợp lệ |
| Authorised Staff | Caller lookup/verification; tạo account và assisted booking; xem giá/availability; quản lý xe/tài xế và journey states; gửi approaching notification; trả lời enquiry; xử lý refund; ghi nhận cash; xem popularity/loyalty |

Leader/Scrum Master là vai trò tổ chức nhóm, không tự tạo ra quyền admin sản phẩm. Staff account được seed/cấp qua thao tác quản trị local đáng tin cậy; không cho khách tự chọn Staff khi đăng ký. Không cần chức năng UI quản lý nhân viên nếu không có yêu cầu mới.

## 2. Toàn bộ yêu cầu, Epics và backlog

### 2.1 Mười bốn yêu cầu nguồn

Các mô tả dưới đây giữ nội dung Table 3 để truy vết. Riêng R6 được áp dụng theo AC/P04 hiện tại đã nói ở mục 0.2; R7 dùng test payments và có thêm Cash do nhóm yêu cầu.

| Requirement | Nội dung nguồn trong báo cáo |
|---|---|
| R1 — Customer registration | Allow customers to register a profile containing their name, email, address, telephone number and credit card details, and receive a registration confirmation email. |
| R2 — Customer enquiries | Allow customers to submit general enquiries or enquiries about a specific trip. |
| R3 — Booking channels and discount | Support online, telephone and in-person bookings, with a 15% discount for online bookings. |
| R4 — Service selection | Offer local and long-distance journeys, airport and hotel transfers, airport meet-and-greet services, and daily hire of a car with a driver. |
| R5 — Online booking details | Require customers to log in and provide the pickup location, destination, journey date and time, passenger count and required vehicle size. |
| R6 — Booking notifications | Record email/text preferences, send booking confirmation emails, and send approaching-driver texts approximately 10–15 minutes before arrival, containing vehicle identification details such as registration, colour and/or make. |
| R7 — Availability, pricing and payment | Check vehicle availability, calculate fares, process payments and verify card details. Accept PayPal and major credit cards, including American Express, with bank verification through VISA Check. |
| R8 — Printable receipt | Produce a printable online receipt after payment, showing journey details and the final cost. |
| R9 — Reviews and ratings | Allow customers to review and rate their completed journey, vehicle and driver. |
| R10 — Booking changes | Allow customers to cancel or amend bookings subject to the 24-hour condition before the intended journey. |
| R11 — Caller verification and accounts | Support caller verification, retrieval of existing customer accounts and creation of accounts for new customers. |
| R12 — Staff access to availability | Give Call Centre staff access to vehicle and driver availability so they can provide accurate information about prices and availability. |
| R13 — Staff operations and communication | Allow staff to email customers, reply to enquiries, create customer accounts, add vehicles and drivers, and make bookings. |
| R14 — Customer insights and offers | Track popular vehicles and loyal customers, recommend offers using customer profile information, and allow offer codes to be applied to the next booking. |

### 2.2 Năm Epics

| Epic | Phạm vi | User stories |
|---|---|---|
| SCRUM-30 — Customer Accounts and Support | Establish a consistent way to identify customers, maintain their information and support communication with the company. | SCRUM-6, SCRUM-7, SCRUM-8, SCRUM-9, SCRUM-21, SCRUM-24 |
| SCRUM-31 — Booking and Journey Management | Provide a coordinated way for customers and staff to arrange and manage journeys across the company’s booking channels. | SCRUM-10, SCRUM-11, SCRUM-12, SCRUM-13, SCRUM-14, SCRUM-15, SCRUM-18, SCRUM-19, SCRUM-23 |
| SCRUM-32 — Payments and Receipts | Provide a clear process for digital and cash payments, together with an accurate record of amounts received for each journey. | SCRUM-16, SCRUM-17, SCRUM-36, SCRUM-37 |
| SCRUM-33 — Staff and Fleet Operations | Support booking operations by keeping the company’s vehicle and driver resources organised and accessible to staff. | SCRUM-22, SCRUM-25, SCRUM-26 |
| SCRUM-34 — Customer Insights and Special Offers | Help the business understand customer preferences and service use, and use this information to encourage repeat bookings. | SCRUM-20, SCRUM-27, SCRUM-28, SCRUM-29 |

### 2.3 Danh sách đủ 26 user stories

| Story | Chức năng | MoSCoW và Jira Priority | Story Points |
|---|---|---|---:|
| SCRUM-6 | Register a customer account | Must Have (High) | 5 |
| SCRUM-7 | Sign in and sign out as a customer | Must Have (High) | 3 |
| SCRUM-8 | View and update customer profile details | Should Have (Medium) | 2 |
| SCRUM-9 | Submit a general or trip-specific enquiry | Should Have (Medium) | 3 |
| SCRUM-10 | Choose a PrivateHire service | Must Have (High) | 2 |
| SCRUM-11 | Submit an online journey booking | Must Have (High) | 5 |
| SCRUM-12 | Check vehicle availability for a requested journey | Must Have (High) | 5 |
| SCRUM-13 | Calculate the fare and the online booking discount | Must Have (High) | 3 |
| SCRUM-14 | Receive and view booking confirmation | Must Have (High) | 3 |
| SCRUM-15 | Receive an approaching-vehicle web notification | Should Have (Medium) | 5 |
| SCRUM-16 | Complete a simulated card or PayPal payment | Must Have (High) | 5 |
| SCRUM-17 | View and print a paid booking receipt | Must Have (High) | 3 |
| SCRUM-18 | Amend an eligible booking | Should Have (Medium) | 8 |
| SCRUM-19 | Cancel an eligible booking | Should Have (Medium) | 8 |
| SCRUM-20 | Review a completed journey, vehicle and driver | Should Have (Medium) | 3 |
| SCRUM-21 | Verify callers and find or create customer accounts | Should Have (Medium) | 3 |
| SCRUM-22 | View vehicle and driver availability as staff | Should Have (Medium) | 3 |
| SCRUM-23 | Create a telephone or in-person booking as staff | Should Have (Medium) | 5 |
| SCRUM-24 | Reply to customer enquiries as staff | Should Have (Medium) | 3 |
| SCRUM-25 | Add and maintain minicab records as staff | Should Have (Medium) | 5 |
| SCRUM-26 | Maintain driver records and demonstrate journey states | Should Have (Medium) | 5 |
| SCRUM-27 | View popular vehicles and loyal customers | Could Have (Low) | 2 |
| SCRUM-28 | Recommend a special offer from customer history | Could Have (Low) | 3 |
| SCRUM-29 | Apply a special-offer code to the next booking | Must Have (High) | 5 |
| SCRUM-36 | Confirm a booking with cash payment | Should Have (Medium) | 3 |
| SCRUM-37 | Record a cash payment as staff | Should Have (Medium) | 3 |

Tổng: **26 US, 140 AC, 103 Story Points**; **10 Must Have, 14 Should Have, 2 Could Have**. Chưa có US nào thuộc Won’t Have trong 26 US này. Đối với sản phẩm cuối, triển khai đủ cả 26. Danh mục AC đầy đủ ở mục 12.

### 2.4 Truy vết requirements với user stories

Mapping dưới đây tương ứng Table 7. Cash ở R7/R8 là phần mở rộng của nhóm; R6 dùng phiên bản notification đã điều chỉnh. Đây là planned coverage, không phải xác nhận các chức năng đã pass.

| Requirement | User stories liên quan |
|---|---|
| R1 | SCRUM-6, SCRUM-8 |
| R2 | SCRUM-9 |
| R3 | SCRUM-11, SCRUM-13, SCRUM-23 |
| R4 | SCRUM-10 |
| R5 | SCRUM-7, SCRUM-11 |
| R6 | SCRUM-14, SCRUM-15 |
| R7 | SCRUM-12, SCRUM-13, SCRUM-16, SCRUM-36, SCRUM-37 |
| R8 | SCRUM-17, SCRUM-37 |
| R9 | SCRUM-20 |
| R10 | SCRUM-18, SCRUM-19 |
| R11 | SCRUM-21, SCRUM-23 |
| R12 | SCRUM-22, SCRUM-26 |
| R13 | SCRUM-21, SCRUM-24, SCRUM-25, SCRUM-26, SCRUM-23 |
| R14 | SCRUM-27, SCRUM-28, SCRUM-29 |

## 3. Giao diện, màn hình và luồng sử dụng

### 3.1 Nguyên tắc giao diện

- Giữ ngôn ngữ giao diện tiếng Anh để khớp báo cáo và các màn hình nhóm đã làm; tài liệu triển khai này giải thích bằng tiếng Việt.
- Reuse branding PrivateHire Cars và giao diện hiện có; không thay toàn bộ theme. Có desktop và mobile-width cho cùng website, không tạo hai hệ thống dữ liệu khác nhau.
- Tham chiếu thiết kế nhóm nếu truy cập được: `https://www.figma.com/design/mUJYTBGIQ1M1xcFqr9vNU4/Wireframe-PrivateHire-Cars`. Nếu không truy cập được vẫn triển khai theo AC, giữ phong cách mã hiện tại; không giả định đã đọc các frame không mở được.
- Header hiển thị Visitor/Log in khi chưa đăng nhập, tài khoản/Sign out khi đã đăng nhập; staff có điều hướng phù hợp.
- Form có label, dấu `*` cho trường bắt buộc, thông báo lỗi cạnh trường, giữ dữ liệu hợp lệ khi sửa lỗi. Toast có thể bổ sung nhưng không thay lỗi cần người dùng xử lý.
- Backend cũng kiểm tra tất cả dữ liệu; lỗi frontend không phải hàng rào phân quyền.
- Có loading, error, empty, success và disabled states khi cần; ngăn bấm lặp bằng UI nhưng backend vẫn kiểm tra trùng.
- Danh sách, bảng, dropdown và dialog dùng được trên điện thoại; không tràn ngang toàn trang; receipt có print CSS.
- Thông báo test chỉ đặt ở giao dịch thanh toán/refund và các controls demo hành trình khi giúp người dùng hiểu. Email là thật; approaching message là web notification lưu thật. Không thêm huy hiệu kỹ thuật “AC1”, “SCRUM”, “SMTP” vào luồng khách hàng thông thường.

### 3.2 Danh sách màn hình cần có

Tên đường dẫn dưới đây là **đề xuất**, giữ đường dẫn hiện có nếu đã làm tương đương. Mỗi chức năng phải có đường truy cập/điều hướng thực sự, không chỉ endpoint.

| Màn hình | Nội dung/thao tác tối thiểu | US |
|---|---|---|
| Home/Services | Giới thiệu sáu dịch vụ, nút book/enquiry, giá được lấy từ dữ liệu mẫu đúng quy tắc | 10, 13 |
| Register | Name, telephone, email, address, password, confirm password, mock card; validation và kết quả thực | 6 |
| Login | Email/password, báo lỗi, liên kết Register, trạng thái session | 7 |
| My profile | Xem/sửa contact và mock-card reference, email đổi dùng đăng nhập được | 8 |
| New booking | Service, pickup, destination, ngày/giờ, số khách, vehicle capacity; tìm xe | 10–12 |
| Available vehicles | Registration/make/colour/capacity và lựa chọn hợp lệ; no-results state | 12 |
| Booking review | Journey, fare breakdown, online discount, offer input, total; tạo Pending booking | 11, 13, 29 |
| Booking payment | PayPal/card test và VISA Check; Cash confirmation; success/failure và amount due | 16, 36 |
| My bookings | List booking thực của owner với booking/payment statuses, mở chi tiết | 7, 11 |
| Booking details | Journey, vehicle, driver nếu có, tổng tiền, trạng thái, payment/refund history; các action đủ điều kiện | 11, 14, 17–20 |
| Amend booking | Điều kiện 24h, đổi journey/service/vehicle, quote mới, top-up/refund khi cần, xác nhận | 18 |
| Cancel dialog | Xác nhận, hậu quả reservation/refund, cho phép dismiss không đổi dữ liệu | 19 |
| Receipt view/print | Paid receipt theo payment records; unpaid cash chỉ có amount due, không paid receipt | 17, 37 |
| Enquiry form | General cho guest/customer; Trip-specific cho owner chọn booking của mình | 9 |
| Review form/view | Text và ba ratings Journey/Vehicle/Driver 1–5; Completed only, một review/booking | 20 |
| Notifications | Tin approaching của owner, nội dung xe và liên kết booking; lưu qua reload/login | 15 |
| Offers | Điều kiện >=3 Completed, offer private, configurable amount, unused/used và hướng dẫn dùng | 28, 29 |
| Staff sign-in/workspace | Lối vào staff bằng quyền backend thực; trang tổng hợp/điều hướng các công cụ | 21–26, 37 |
| Caller lookup/verification | Tìm email/phone, xác minh name/phone; tạo khách mới; chuyển customer context | 21 |
| Staff availability/quote | Vehicle/driver theo period/service/passengers, channel, quote; không reserve khi search | 22 |
| Assisted booking | Customer đã xác minh, Telephone/In-person, journey, review, electronic/cash confirmation | 23 |
| Staff bookings/journey operations | Chọn booking, assign driver, Assigned → EnRoute → Completed, Notify customer | 15, 26 |
| Staff enquiries | List/detail, original message, linked booking, reply history, gửi reply email | 24 |
| Fleet maintenance | Thêm/sửa registration/make/colour/capacity/status; ràng buộc active booking | 25 |
| Driver maintenance | Thêm/sửa name/phone/reference/status; lịch bận và ràng buộc assignment | 26 |
| Refund queue | Pending/Processed request, booking/reason/amount, xử lý một lần, audit actor/time | 19 |
| Cash collection | Completed/Cash/Unpaid, amount due, Confirm cash received, xem receipt | 37 |
| Customer insights | Popular vehicles, loyal customers, Completed counts, descending order và empty state | 27 |

### 3.3 Luồng khách hàng đầy đủ

1. Khách đăng ký với email thật, dữ liệu hợp lệ được lưu và thư xác nhận được gửi. Đăng nhập bằng account đã tạo.
2. Chọn dịch vụ, nhập journey và capacity, tìm xe còn phù hợp, xem giá và discount.
3. Tạo booking Pending/Unpaid; xem lại trong My bookings. Bước này chưa reserve xe.
4. Chọn electronic test payment hoặc Cash. Backend kiểm tra lại trước khi confirmation.
5. Electronic success: Confirmed/Paid; Cash: Confirmed/Unpaid. Cả hai reserve xe và gửi email thật.
6. Staff assign driver, chuyển EnRoute, nhấn Notify customer; owner xem thông báo trong web account kể cả khi gửi lúc owner offline.
7. Staff chuyển Completed. Nếu Cash còn Unpaid, staff ghi nhận đủ tiền; Paid receipt xuất hiện trong booking details.
8. Owner có thể review Completed booking; Paid không phải điều kiện review.
9. Owner đạt >=3 Completed mở Offers để nhận một recommendation riêng và email; dùng code trong một booking sau.
10. Với booking khác còn đủ 24h trước pickup và đúng state, owner sửa/hủy theo P05; xem refund tiến độ trong app.

### 3.4 Luồng staff đầy đủ

Staff đăng nhập → xác minh khách có sẵn hoặc tạo khách mới → chọn Telephone/In-person → tìm availability/quote → lưu booking Pending → electronic hoặc cash confirmation → assign driver → EnRoute → Notify customer → Completed → record cash nếu cần. Các công cụ reply enquiry, refund queue, fleet/driver và insights dùng chung dữ liệu đã lưu, không có dataset frontend riêng.

## 4. Quy tắc nghiệp vụ P01 đến P09

Các đoạn tiếng Anh dưới đây được lấy từ mục 3.2.2 của báo cáo, giữ ý nghĩa nguồn. Bảng giá kèm theo là seed chuẩn cho nguyên mẫu. Các quyết định kỹ thuật bổ sung nằm ở mục 5–10.


### P01 — Accounts and Access

- **Registration details:** Customers register using their name, email, address, telephone number, password and a provided mock card reference. Missing required information, an invalid email or an email already registered prevents account creation.
- **Mock card information:** The prototype stores a mock card reference and displays it in a masked format. Customers do not enter real bank-card details. This reference does not restrict the payment method selected for a booking.
- **Registration confirmation:** Successful registration sends a real confirmation email to the registered address.
- **Account access:** Customers sign in using their registered email and password. Signing out ends access to protected customer pages. Customers can access only their own profiles, bookings, payment details and receipts.
- **Profile changes:** Customers can update their contact details and selected mock card reference. A changed profile email becomes the customer’s sign-in email.
- **Enquiries:** Guests and signed-in customers may submit general enquiries using a valid reply email. Trip-specific enquiries require a signed-in customer and a booking belonging to that account.
- **Staff access:** Staff functions require an authorised staff account.

### P02 — Demonstration fares and availability Windows

- **Sample pricing:** The prototype uses the fares and journey durations in Table 8. These are illustrative test values selected for the prototype, rather than prices supplied in the case study. The fare depends on the selected service and vehicle capacity; it is not calculated from actual travel distance.

| Service | 4 seats GBP | 7 seats GBP | Occupied minutes |
|---|---:|---:|---:|
| Local journey | 20.00 | 30.00 | 60 |
| Long-distance journey | 80.00 | 120.00 | 180 |
| Airport transfer | 45.00 | 65.00 | 90 |
| Hotel transfer | 30.00 | 45.00 | 60 |
| Airport meet-and-greet | 55.00 | 80.00 | 120 |
| Driver and car daily hire | 200.00 | 280.00 | 480 |

- **Vehicle capacity:** Passenger count must be a positive whole number within the selected vehicle’s capacity of four or seven.
- **Occupied period:** A journey occupies the period from pickup up to, but excluding, its calculated end time. Two journeys conflict when their occupied periods overlap. A journey ending at 11:00 does not conflict with another starting at 11:00.
- **Vehicle reservations:** Confirmed, Assigned and EnRoute bookings reserve their selected vehicles, including cash bookings that remain Unpaid. Pending bookings do not reserve vehicles.
- **Driver reservations:** Drivers are unavailable during overlapping Assigned or EnRoute bookings.
- **Availability checks:** Availability is checked again before confirming a booking or saving an amendment.
- **Discounts and rounding:** Online bookings receive a 15% discount for card, PayPal and cash payments. Telephone and In-person bookings receive no automatic online discount. The backend calculates amounts in GBP to two decimal places. Valid offer discounts are applied after the online discount.

### P03 — Booking and payment lifecycle

- **Separate statuses:** Booking status and payment status are recorded separately. Booking statuses are Pending, Confirmed, Assigned, EnRoute, Completed and Cancelled. Payment statuses are Unpaid, Paid and Refunded. The fare is stored separately from these statuses.
- **Initial booking:** A newly saved booking starts as Pending and Unpaid. It receives a booking reference but does not reserve a vehicle.
- **Checks before confirmation:** The system checks the future pickup time, backend-calculated fare, vehicle availability and any attached offer before confirmation.
- **Electronic payment:** The payment screen provides test PayPal, Visa, Mastercard and American Express scenarios with Success and Failed outcomes. Card payments also include a VISA Check Pass/Fail result. Failed verification prevents successful payment.
- **Successful electronic payment:** Success records the payment, changes the booking to Confirmed and Paid, reserves the vehicle and marks any applied offer as used.
- **Failed electronic payment:** Failure leaves the booking Pending and Unpaid without a successful payment, reservation, paid receipt or offer consumption. A booking already confirmed, paid or cancelled cannot repeat the initial payment flow.
- **Cash confirmation:** Selecting Cash allows a valid booking to become Confirmed while remaining Unpaid. The vehicle is reserved, any applied offer is consumed, and the amount due at the end of the journey is displayed.
- **Staff-assisted bookings:** Authorised staff may perform the electronic payment or cash-confirmation steps for Telephone and In-person bookings.
- **Journey progression:** Assigning an available Active driver changes a Confirmed booking to Assigned. Staff can then use simulation controls to move it to EnRoute and Completed, in that order, without waiting for real journey time. Completing a journey does not automatically record payment.
- **Cash collection:** Only authorised staff may record cash received for a Completed, Cash, Unpaid booking. The full amount due is displayed, and staff use a confirmation button without entering the amount again. The record stores the amount, method, time and staff member. Payment status becomes Paid while booking status remains Completed. An already Paid booking cannot create another cash-collection record.
- **Receipts:** Payment information appears in booking details for every payment method. Unpaid cash bookings show the amount due. A printable paid receipt becomes available after successful electronic payment or recorded cash collection. Payment and refund history remains visible to the booking owner and authorised staff.
- **Financial simulation:** Electronic payments, cash-collection records and refunds are test transactions. The prototype does not transfer real money.

### P04 — Notifications

- **Notification channels:** Booking confirmations use real email. Approaching-vehicle notifications are delivered through the customer’s web account following the tutor’s clarification. The booking form does not require a notification-channel choice.
- **Booking-confirmation email:** A real confirmation email is sent automatically when a booking becomes Confirmed, including an unpaid cash booking. Pending bookings and failed payments do not produce a successful-booking confirmation email.
- **Confirmation contents:** The email uses the contact saved with the booking and includes the booking reference, journey details, service and vehicle, total, payment method, payment status and any amount still due. Reprocessing the same confirmation does not send a duplicate email.
- **Staff trigger:** Authorised staff can select Notify customer only when the booking is EnRoute and has an assigned vehicle and driver.
- **Demonstration timing:** The manual trigger represents the vehicle being approximately 10–15 minutes away. No actual countdown, live GPS connection or waiting period is required.
- **Web notification:** Sending creates a saved notification in the booking owner’s Notifications page. It contains the booking reference, vehicle registration, make, colour and expected-arrival message, with a link to the related booking.
- **Access and persistence:** Customers can view only their own notifications and bookings. Notifications remain available after reloading or signing in again, including when the customer was signed out when staff sent the message.
- **Duplicate prevention:** Repeating the action for the same booking does not create duplicate approaching-vehicle notifications.
- **Ineligible bookings:** Pending, Confirmed, Assigned, Completed and Cancelled bookings cannot create an approaching-vehicle notification. Missing vehicle or driver assignments also prevent sending.
- **Cancellation:** Cancellation prevents new approaching-vehicle notifications. Previously stored notifications remain in the customer’s history.

### P05 — Amendments, cancellations and financial adjustments

- **Eligibility:** Only the owner may amend or cancel a Pending, Confirmed or Assigned booking when its existing scheduled pickup is at least 24 hours away. Exactly 24 hours is accepted. The condition is measured before pickup, rather than from booking creation. EnRoute, Completed and Cancelled bookings are ineligible.
- **Permitted amendments:** Customers may change journey details, service and vehicle. The revised pickup must be in the future, passenger count must fit the vehicle, and the vehicle must be available. An Assigned booking must also retain driver availability. Conflict checks exclude the booking’s own existing reservations.
- **Fare recalculation:** The system recalculates the fare using the sample table, original booking channel and previously applied offer benefit. The revised total is shown before the customer confirms.
- **Unpaid amendments:** A valid amendment updates the amount due without taking payment or creating a refund. Pending bookings remain Pending without a reservation. Confirmed or Assigned cash bookings retain their state and update their reservations.
- **Higher paid fare:** A Paid booking with a higher revised total requires a successful test payment for the increase before the amendment is saved. Failure leaves the previous booking and paid amount unchanged.
- **Lower or unchanged paid fare:** A lower revised total creates or updates a Pending refund request for the decrease. An unchanged total creates no financial adjustment.
- **Cancellation confirmation:** The customer must confirm cancellation. Dismissing the confirmation leaves the booking unchanged. Successful cancellation immediately sets Cancelled, releases vehicle and driver reservations, and prevents new approaching-vehicle web notifications. Previously stored notifications remain in the customer’s history.
- **Refund eligibility:** Unpaid cancellations create no refund request. A paid cancellation requests the remaining net amount paid, calculated as successful payments minus previously processed refunds.
- **One pending request:** Each booking has at most one Pending refund request. If cancellation occurs while a partial refund is pending, the existing request is updated to the remaining net paid amount instead of creating a second request.
- **Refund processing:** Authorised staff view the refund queue and process requests within the application. Processing records the amount, time and staff member and changes the request to Processed. A Processed request cannot be processed again.
- **Payment status after refund:** Processing the full refund for a Cancelled booking changes payment status to Refunded. Processing a partial refund for an active amended booking leaves payment status Paid. Customers can view refund progress in booking details.
- **Failed amendments:** Invalid or conflicting changes leave the previous booking details, reservations and financial records unchanged.
- **Offer treatment:** Cancellation does not restore an offer already consumed when the booking was confirmed.

### P06 — Staff verification and resource records

- **Existing customers:** Authorised staff find an account using its email or telephone number and check the supplied name and telephone number. Failed verification prevents booking for that account.
- **New customers:** Staff confirm the caller’s contact details and create an account using the registration form. The selected or newly created account is then used for the booking.
- **Booking channels:** Staff record Telephone or In-person as the channel and retain the correct customer and staff member. These bookings use the shared pricing, payment and confirmation workflows.
- **Enquiry replies:** Staff can view enquiries and any linked booking, save a non-empty reply with its author and time, and send the reply by real email. Failed saves do not mark the enquiry as answered.
- **Vehicle records:** Vehicles have a unique registration, make, colour, capacity of four or seven, and Active/Unavailable status. Updates preserve booking links and cannot reduce capacity below an active booking’s passenger count or make its reserved vehicle unavailable.
- **Driver records:** Drivers have a name, telephone number, unique driver reference and Active/Unavailable status. Only an available Active driver may be assigned. A driver with an Assigned or EnRoute booking cannot be marked Unavailable.
- **Saved information:** Valid customer, vehicle, driver and assignment records remain available after reloading.

### P07 — Reviews and ratings

- **Eligibility:** Only the owner of a Completed booking may submit a review. Paid status is not required, so a completed cash journey may be reviewed while still Unpaid.
- **Required content:** Reviews require non-empty text and separate whole-number ratings from one to five for the journey, vehicle and driver. Missing or invalid values prevent saving.
- **Review limit:** Each booking accepts one review. Another submission does not replace the saved review.
- **Saved review:** The review remains linked to the correct booking, customer, vehicle and driver and is available after reloading.

### P08 — Popularity and loyalty metric

- **Vehicle popularity:** Popularity is the number of stored Completed bookings associated with each vehicle.
- **Customer loyalty:** Loyalty is the number of stored Completed bookings associated with each customer, including completed cash journeys that remain Unpaid.
- **Reporting period:** The prototype uses all recorded sample history. Pending, Confirmed, Assigned, EnRoute and Cancelled bookings do not contribute to the counts.
- **Presentation:** Results are ordered by count in descending order. An empty dataset displays an appropriate empty state.

### P09 — Special offers

- **Eligibility:** A customer with at least three Completed bookings and no previous recommendation is eligible for one customer-linked offer.
- **Recommendation trigger:** Opening the signed-in customer’s Offers page evaluates eligibility. An eligible customer receives the offer in their account and through a real recommendation email. Reopening the page displays the existing recommendation.
- **Offer value:** Each offer has a configurable discount amount. GBP 5 and GBP 10 are examples, rather than fixed limits. Offers have no expiry date in this prototype.
- **Code validation:** A newly applied code must exist, belong to the booking customer and remain unused. Invalid codes display an error and apply no offer discount.
- **Discount calculation:** Each booking accepts at most one code. Its stated amount is deducted after any online discount for every booking channel and payment method. The final total cannot be negative.
- **Quote review:** The revised total is displayed before confirmation. If the attached code is no longer valid at confirmation, the corrected total must be reviewed before continuing.
- **Offer consumption:** A code is marked used when the booking successfully becomes Confirmed through electronic payment or cash confirmation. Failed confirmation does not consume it, and later cash collection does not consume it again.
- **Amendments and cancellations:** An eligible amendment retains the discount benefit already applied to the booking. Cancellation does not restore the consumed code.

## 5. Quy tắc triển khai dùng chung

Các yêu cầu dưới đây diễn giải các AC thành hành vi kỹ thuật có thể kiểm tra. Không thay đổi P01–P09. Những điểm nguồn chưa chốt được nêu riêng ở mục 10.

### 5.1 Xác thực và phân quyền backend

- Registration không tự cấp quyền staff. Login dùng email/password đúng dữ liệu đã lưu; password lưu bằng bcrypt hash, không plain text hay reversible encryption.
- Trim email và so sánh không phân biệt hoa thường. Bảo đảm uniqueness ở database và backend, không chỉ gọi kiểm tra trước INSERT. Profile update loại trừ account hiện tại khi kiểm tra trùng.
- Confirm password được kiểm tra nhưng không lưu trong database, không trả password/hash ra API.
- Session/token phải được server phát hành và kiểm chứng cho mỗi API riêng tư. Không lấy object `currentUser`, email, account ID hoặc role từ localStorage/request body làm bằng chứng đăng nhập.
- Sign-out phải kết thúc quyền truy cập ở server, không chỉ xóa badge hoặc localStorage. Back/reload hoặc dùng lại token cũ không đọc được dữ liệu bảo vệ.
- Mọi get/update/payment/receipt/review/enquiry/notification/offer đều check owner hoặc staff đúng quyền. UI ẩn nút chỉ là hỗ trợ, không thay middleware và truy vấn giới hạn quyền.
- Khi sửa email profile, account ID không đổi; quyền, booking cũ và session tiếp tục dựa account ID. Các lần đăng nhập sau dùng email mới.
- Staff operations ghi actor từ session. Không tin `staffId`, `customerId`, trạng thái, giá hoặc kết quả verification do client tự gửi nếu chưa kiểm chứng.
- General enquiry là endpoint công khai có validation. Endpoint trả toàn bộ accounts/email history/test-db/demo-seed hiện có chỉ dành công cụ local được bảo vệ hoặc bỏ khỏi luồng public bằng lớp tích hợp được leader duyệt.
- **Đề xuất kỹ thuật:** dùng opaque session token do `crypto` tạo, lưu hash/token reference với expiry trong database, gửi bằng HttpOnly cookie; hoặc giải pháp khác có revocation và kiểm tra role/owner tương đương. Cấu hình cookie phù hợp localhost, CORS origin cụ thể khi dùng credentials. Không hứa bảo vệ đầy đủ nếu chỉ có frontend state.

### 5.2 Thời gian và availability

- Lưu timestamp có timezone; backend là nơi quyết định giờ hiện tại. **Đề xuất:** lưu UTC và hiển thị giờ hành trình theo `Europe/London`; label timezone trong date/time input hoặc phần review để không nhập giờ Việt Nam rồi hiểu thành London.
- `journeyEnd = pickupAt + durationMinutes(service)`; thời lượng là occupied window mẫu, không phải thời gian đo GPS hoặc lựa chọn tính tiền theo phút.
- Overlap theo khoảng nửa mở: `startA < endB && startB < endA`. Kết thúc đúng lúc chuyến sau bắt đầu là hợp lệ.
- Vehicle busy từ Confirmed/Assigned/EnRoute; include Unpaid cash. Driver busy từ Assigned/EnRoute. Pending và Cancelled không giữ tài nguyên; Completed không tạo reservation active mới.
- Chỉ xe Active và capacity đủ mới chọn được. Không coi driver busy khi chỉ có một booking Pending chưa assign.
- Amend exclude chính reservation hiện có của booking đó; Assigned amend giữ driver đang assign và phải kiểm tra driver đó với period mới.
- Eligibility sửa/hủy lấy `existingPickupAt - serverNow >= 24h`, chấp nhận đúng 24h; không tính 24h từ lúc tạo, không đổi thành 5 phút. Sau khi qua điều kiện này, revised pickup phải ở tương lai theo AC, không tự áp thêm điều kiện revised pickup >=24h nếu nguồn không yêu cầu.
- Recheck ngay trong thao tác commit, không chỉ search vài phút trước. Hai khách cùng confirm một xe cùng period: chỉ một booking được reserve; booking còn lại nhận conflict rõ ràng, không phát sinh paid receipt/offer use sai.
- **Đề xuất kỹ thuật:** transaction và khóa vehicle/driver liên quan hoặc constraint thích hợp để chặn race condition; định thứ tự khóa nhất quán. Không dùng kiểm tra frontend hoặc SELECT-then-INSERT không khóa làm bảo đảm duy nhất.

### 5.3 Giá tiền, quote và trạng thái

```text
baseFare = fareTable[selectedService][selectedVehicle.capacity]
onlineDiscount = channel == Online ? roundCurrency(baseFare * 0.15) : 0
afterOnlineDiscount = baseFare - onlineDiscount
offerDiscount = validatedOffer ? validatedOffer.amount : 0
total = max(0, afterOnlineDiscount - offerDiscount)
```

- Dùng integer pence hoặc kiểu decimal rõ precision; display `GBP`/`£` và hai số thập phân. Không tin tổng do client gửi.
- £5/£10 là ví dụ offer; không hard-code mọi offer chỉ được £5. Không tính online discount dựa vào payment method.
- Persist fare snapshot: base, channel discount, applied offer benefit và final total của booking. Giữ lịch sử payment/refund; không tính lại receipt cũ từ bảng giá hiện tại.
- Quote có định danh/version hoặc giá snapshot để phát hiện thay đổi trước confirmation. Nếu giá/offer không còn đúng, trả corrected total và yêu cầu người dùng review; không âm thầm thu mức khác giá vừa xem.
- Mock card đã chọn khi đăng ký là reference dữ liệu demo, không ép mọi booking phải dùng card đó hoặc cấm Cash/PayPal.

| Thao tác | Booking state sau khi thành công | Payment state | Reservation |
|---|---|---|---|
| Tạo booking hợp lệ | Pending | Unpaid | Không |
| Electronic test payment thành công | Confirmed | Paid | Reserve vehicle |
| Electronic failure/VISA Check Fail | Giữ Pending | Giữ Unpaid | Không |
| Cash confirmation hợp lệ | Confirmed | Unpaid | Reserve vehicle |
| Assign driver hợp lệ | Assigned | Giữ nguyên | Giữ vehicle và reserve driver |
| Staff chuyển EnRoute | EnRoute | Giữ nguyên | Giữ vehicle/driver |
| Staff chuyển Completed | Completed | Giữ nguyên, cash có thể Unpaid | Không còn reservation active |
| Ghi nhận cash hợp lệ | Giữ Completed | Paid | Không thay đổi |
| Owner cancel hợp lệ | Cancelled | Unpaid hoặc Paid chờ xử lý hoàn | Release vehicle/driver |
| Xử lý full refund cho Cancelled | Giữ Cancelled | Refunded | Không |
| Xử lý partial refund cho booking active | Giữ state hiện có | Paid | Giữ reservations hợp lệ |

- Chặn unsupported/backward transition và double confirmation. Tiến trình hành trình chỉ staff thao tác, không cần đợi thời gian thực.
- Cash collection chỉ Completed/Cash/Unpaid, amount tự đọc từ backend; không có ô tự nhập tiền khác hoặc partial collection ngoài scope.
- Paid receipt chỉ khi có payment success hoặc cash collection success. “Confirmed” không đồng nghĩa “Paid”.

### 5.4 Amendment, refund và tính nhất quán tài chính

- Lưu booking details và ledger nhất quán: payment success, reserve và consume offer phải cùng kết quả transaction. Failure không để booking đổi một nửa.
- Paid amendment tăng giá chỉ commit sau test top-up success; top-up failure không thay details/reservations/paid amount. Tách top-up khỏi initial payment để không bị AC chặn thanh toán lặp của booking đã Confirmed.
- Paid amendment giảm giá tạo/cập nhật một Pending refund. Cancel update Pending refund thành số net paid còn lại, không cộng chồng yêu cầu partial và full.
- `netPaid = successful payments - processed refunds`. Pending refund chưa phải tiền đã trả; không trừ nó như một refund đã Processed.
- Staff process một request đúng một lần, ghi amount/time/actor. Không cho processed refund vượt netPaid hoặc process request thay đổi stale từ tab khác.
- Sau partial refund của booking active, payment state vẫn Paid. Sau refund toàn bộ netPaid của Cancelled mới chuyển Refunded.
- Mọi giá trị/eligibility được tính lại server-side; lock booking và refund/offer liên quan khi update để chống bấm lặp và xử lý đồng thời.
- Booking lịch sử không bị hard-delete; thay đổi state và lưu lịch sử để receipt, review, enquiry, metrics còn tham chiếu.
- Nguồn chưa chốt trường hợp sửa nhiều lần trước khi staff xử lý partial refund và giá bằng 0. Xử lý theo mục 10, không tự thêm tiền phạt hoặc quy tắc khác.

### 5.5 Email thật và thông báo web

- Shared email service hỗ trợ bốn message types: registration confirmation, booking confirmation, enquiry reply, offer recommendation. Có plain text và HTML, escape dữ liệu người dùng.
- Giữ sender SMTP và App Password ở backend `.env.email.local`/environment. Ví dụ cấu hình không chứa credential thật:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<sender Gmail entered locally>
SMTP_PASS=<Google App Password entered locally>
EMAIL_FROM_NAME=PrivateHire Cars
EMAIL_LOGIN_URL=http://localhost:5173/login.html
```

- Email đăng ký thông báo account đã tạo; không gửi password, không đòi activate/verify link theo scope hiện tại.
- Email booking dùng contact snapshot lưu cùng booking, không tự đổi người nhận booking cũ khi customer sửa profile. Có booking reference, pickup/destination/date/time, service/vehicle, total, method/status, amount due.
- Không gửi successful booking email cho Pending hoặc payment failure. Confirmed cash có email dù còn Unpaid.
- Không trả `emailSent: true` hay hiển thị SENT khi mới tạo preview hoặc khi SMTP fail. SMTP acceptance và nhận thư trong Inbox là hai mức minh chứng khác nhau.
- **Đề xuất kỹ thuật:** durable email jobs/outbox có event key unique, pending/sent/failed, retry được quản lý; transaction nghiệp vụ tạo event sau khi booking/account/reply/offer hợp lệ. Không giữ transaction DB mở trong lúc gọi SMTP.
- Chỉ bốn luồng email trên là bắt buộc; việc retry không được tạo lại booking/account/offer hoặc phát sinh payment lần nữa.
- SMTP không bảo đảm exactly-once ở mọi tình huống mạng. Chặn duplicate do repeated application action bằng unique event/idempotency; ghi riêng kết quả không chắc chắn sau timeout, không tự retry mù hoặc hứa exactly-once delivery.
- Approaching là bản ghi database của owner, không phải email/SMS. `Notify customer` chỉ EnRoute có driver và vehicle; message nói khoảng 10–15 phút, không countdown/GPS. Gửi một lần cho mỗi booking, reject state khác.
- Không bắt customer online lúc staff gửi; reload/login sau vẫn thấy notification và mở booking thuộc owner.
- **Đề xuất UI đơn giản:** fetch notification khi mở trang và refresh/poll có kiểm soát khi đã đăng nhập. WebSocket/push hệ điều hành không bắt buộc để đáp ứng AC.

### 5.6 Idempotency và lỗi

- Dùng unique constraint/key cho one-review-per-booking, one-recommendation-per-customer, one-approaching-notification-per-booking, một Pending refund/booking và các successful confirmation/cash/refund event tương ứng.
- Không “sửa” duplicate bằng cách trả thành công nhưng tạo thêm record. Có thể trả existing result hoặc lỗi state nhất quán.
- Validation fail không đổi dữ liệu hiện có. Authorization fail không trả nội dung tài khoản khác. Conflict không tự thay xe/giá mà không cho người dùng review.
- Nếu account/booking đã lưu nhưng gửi email lỗi, trả và hiển thị đúng partial state, giữ record và có cách retry có kiểm soát. Không yêu cầu khách đăng ký/đặt xe lại để gửi email.
- Đề xuất response: `400` invalid input, `401` no session, `403` wrong role/owner, `404` not found (có thể dùng để tránh lộ resource), `409` stale state/conflict/duplicate. Giữ status/response hiện tại nếu cần tương thích và hành vi rõ ràng. Không đổi endpoint cũ chỉ vì khác quy ước đề xuất.

## 6. Dữ liệu và backend đề xuất

Đây là mô hình gợi ý để hiện thực AC, không phải ERD bắt buộc từ CW. Reuse bảng hiện có và thêm migration không phá dữ liệu; không drop/recreate hoặc reset database của nhóm.

| Entity | Dữ liệu/ràng buộc chính |
|---|---|
| accounts | id, unique account_code, name, normalised unique email, address, telephone, password_hash, mock_card_ref, status, role hoặc staff mapping, timestamps |
| mock_cards | code unique, brand, masked_reference, active; preserve catalogue hiện tại |
| sessions | account_id, token hash/reference, expiry, revoked_at nếu chọn server-side sessions |
| services | code/name unique, occupied duration; sáu dịch vụ từ Table 8 |
| service_fares | service_id + capacity unique, base amount pence/decimal; giá Table 8 |
| vehicles | unique registration, make, colour, capacity IN (4,7), status Active/Unavailable |
| drivers | unique reference, name, telephone, status Active/Unavailable |
| bookings | unique reference, owner/customer ID, creator staff ID nullable, channel, pickup/destination, pickup/end, passengers, service/vehicle/driver, booking/payment states, payment method, contact snapshot, price/offer snapshot, version, timestamps |
| booking_events/assignments | booking, old/new state hoặc assignment details, actor, timestamp; giữ lịch sử đáng tin cậy |
| reservations hoặc logic busy từ bookings | vehicle/driver, occupied period, booking ID; đồng bộ đúng statuses và concurrency |
| payments | reference unique, booking ID, Initial/TopUp/CashCollection, method, amount, outcome, actor/time, idempotency key; không có real card data |
| refund_requests | booking, reason, amount, Pending/Processed, version, processor/time; tối đa một Pending/booking |
| refunds | processed payment adjustment amount/reference/time/actor, link request; unique processed event |
| enquiries | reference, type, owner nullable, reply email, message, linked booking nullable, status, timestamps |
| enquiry_replies | enquiry, staff actor, non-empty message, timestamp, email delivery reference/status |
| reviews | unique booking ID, customer/vehicle/driver ID, text, three integer ratings 1–5, timestamp |
| notifications | owner, booking, type ApproachingVehicle, content/vehicle snapshot, timestamp; unique booking/type |
| offers | code unique, customer, configured amount, recommendation origin, used_by_booking nullable, timestamps; customer recommendation unique |
| email_deliveries/outbox | message type, business record, recipient snapshot, event key unique, body, state, provider reference và timestamps; không lưu SMTP secret |

Ràng buộc foreign key và transaction phải bảo vệ các mối quan hệ. Không dùng localStorage làm database chính hoặc tin role/customer ID do frontend tự khai. Thông tin header cache không thay thế session server.

### 6.1 API cần bao phủ

Tên dưới đây là contract **đề xuất**, không yêu cầu đổi route đã có. Chọn endpoint thực tế, ghi trong tài liệu và bảo vệ tương đương. Các thao tác thay đổi dữ liệu dùng POST/PATCH/DELETE phù hợp, không vô tình cập nhật dữ liệu khi GET refresh.

| Nhóm | Thao tác backend |
|---|---|
| Accounts/auth | Register; Login; Logout; Current session; Get/update own profile; list valid mock cards |
| Catalogue/quotes | List services; vehicle availability search; calculate/recalculate quote và offer preview |
| Customer bookings | Create Pending booking; list/get owned bookings; confirm electronic; confirm cash; preview/commit amendment; cancel |
| Payment information | Owned/staff payment history; current amount due; receipt data/print view; refund progress |
| Enquiries/reviews | Create general/trip enquiry; relevant enquiry history nếu UI cần; submit/get own booking review |
| Notifications/offers | List owned notifications; evaluate/retrieve offer recommendation; read own offer; validate offer in quote |
| Staff lookup | Lookup customer; verify caller; create new customer; pass verified context to assisted booking |
| Staff booking | Availability/quote; assisted booking create/confirm; assign available driver; progress journey; Notify customer |
| Staff operations | Enquiry list/detail/reply; vehicle add/update/list; driver add/update/list |
| Staff finance | Pending/Processed refund queue; process request once; cash-eligible bookings; record full cash received |
| Staff reporting | Popular vehicles và loyal customers từ Completed counts |
| Local tooling | Health/database health; safe test data setup; email SMTP verify CLI; không public toàn bộ accounts/email logs |

Đối với Offers page, AC mô tả việc mở trang đánh giá eligibility. Có thể dùng UI mở trang gọi POST idempotent “evaluate recommendation”, rồi GET để đọc; không cần ép side effect vào GET.

## 7. Dự án đang có và cách tích hợp

### 7.1 Cấu trúc quan sát tại thời điểm soạn

```text
PrivateHire_Cars-main/
  backend/
    package.json
    src/server.js
    src/server-with-email.js
    src/config/db.js
    src/controllers/accountController.js
    src/models/accountModel.js
    src/routes/accountRoutes.js
    src/routes/healthRoutes.js
    src/database/schema.sql
    src/services/emailService.js
    src/services/realEmailService.js
    src/email/loadEmailEnvironment.js
    src/email/installRegistrationEmail.js
    verify-email.js
    start-with-email.bat
    EMAIL_SETUP.md
    test/registration-email.test.js
  frontend/
    package.json
    vite.config.js
    index.html
    register.html
    login.html
    home.html
    src/...
  frontend_react_backup/...
  docker-compose.yml
  run-all.bat
```

- Backend: Node.js/Express, `pg`, bcryptjs, dotenv, Nodemailer. PostgreSQL là dữ liệu bền; pg-mem đang là fallback/test tool.
- Frontend có React dependencies nhưng các trang HTML đang chứa nhiều giao diện/logic thực. Kiểm tra entry thực tế trước khi làm; không tự migrate tất cả sang React hoặc chỉnh thư mục backup.
- API đang có register/login/accounts/mock-cards/emails/test-db/seed-demo. Registration đã có hook email sau khi lưu account, có lớp real-email bổ sung.
- Kiểm tra code hiện tại cho thấy login backend trả thông tin account sau bcrypt compare; chưa thấy middleware/session/logout server-side trong mã backend đã đọc. Báo cáo có mô tả session token nhưng không đủ để coi server authorisation đã hoàn thành. Cần xác minh và bổ sung theo SCRUM-7.
- Frontend có lưu `currentUser` localStorage. Đó chỉ nên là UI cache; không dùng làm cơ chế bảo mật thật.
- Nội dung `home.html` có phần map/animation hoặc giá trị demo không phải yêu cầu tích hợp GPS. Giữ phong cách giao diện nhưng không làm cho dữ liệu demo thay thế booking/availability thật ở DB.

### 7.2 Yêu cầu bảo toàn và migration

1. Đọc trạng thái file trước mỗi thay đổi. Không ghi đè phần thành viên vừa sửa từ một phiên bản cũ hoặc snapshot trong tài liệu.
2. Thêm module mới theo capability; nếu nối vào code cũ cần sửa, trình leader thay đổi tối thiểu như mục 0.
3. Database migration thêm bảng/cột/index, có kiểm tra dữ liệu cũ và seed idempotent; không xóa tài khoản/booking hiện có.
4. Nếu email uniqueness cũ case-sensitive, xử lý dữ liệu trùng khác hoa thường trước khi thêm unique constraint; không tự merge/xóa account.
5. Tạo staff test account bằng setup local có quyền, lấy secret từ môi trường hoặc generate cho người chạy. Không đăng ký staff qua public form.
6. Không log App Password, database password, password đăng ký/login, session token hoặc hash password vào báo cáo người dùng.
7. Chính sách “không sửa code cũ” không được lách bằng dynamic monkey-patch khó kiểm soát khắp dự án. Có adapter email hiện tại cần giữ tương thích; chỉ dùng thêm wrapper khi rõ thứ tự load và có integration test. Nếu kiến trúc cũ cần điểm tích hợp thực, báo leader.

### 7.3 Khởi chạy và cấu hình

Đích vận hành là frontend local `http://localhost:5173`, backend `http://localhost:5000` và PostgreSQL local. Cổng có thể cấu hình nhưng phải thống nhất với frontend/CORS và email links.

```powershell
# Ví dụ, chạy từ từng thư mục sau khi kiểm tra package.json hiện tại
cd backend
npm.cmd ci
node verify-email.js
node src/server-with-email.js

# Terminal riêng
cd frontend
npm.cmd ci
npm run dev
```

- Tại ngày soạn, backend `package.json` đã trỏ start/dev vào `server-with-email.js`. `EMAIL_SETUP.md` có đoạn cũ nói start/dev chưa bật email; kiểm tra script thực tế, không sửa code theo hướng dẫn lỗi thời.
- `npm ci` chỉ dùng khi lockfile hợp lệ/đồng bộ. Không xóa lockfile để giải quyết lỗi máy mà không tìm nguyên nhân. Dependency Windows optional nếu thiếu chỉ cài đúng phiên bản cần thiết, không nâng mọi package.
- PostgreSQL dùng DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD trong file local. Có Docker Compose sẵn nếu môi trường dùng được; không tự cài dịch vụ hệ thống nếu chưa được phép.
- Final verification phải chạy với PostgreSQL bền. pg-mem được dùng cho tests/demo sớm nhưng mất dữ liệu khi restart, không đủ để tuyên bố final persistence đã đạt.
- Nếu SMTP chưa có cấu hình hoặc không thể xác thực, báo đúng email chưa kiểm tra. Không dùng in-memory preview thay email thật rồi đánh dấu AC Pass.
- Không kill mọi tiến trình Node để giải phóng cổng. Xác định đúng process của dự án và chỉ dừng khi phù hợp.

## 8. Thứ tự triển khai và phụ thuộc

Đây là thứ tự kỹ thuật đề xuất, không tạo/sửa lịch sử ba Sprint của nhóm.

| Nhóm công việc | Chức năng | Phụ thuộc/điểm kiểm tra |
|---|---|---|
| A. Nền tảng và truy cập | Giữ registration/email; hoàn thiện session, role, owner checks; persistent DB | Account identity, app startup, migrations, real SMTP |
| B. Dữ liệu và booking ban đầu | Services/fares; vehicles seed; availability; pricing; Pending booking/details | A; rules period và backend quote |
| C. Confirmation và receipts | Offer redemption foundation/seed; electronic test; cash confirm; email confirm; receipt | B; transaction consistency, owner/staff permissions |
| D. Staff và journey | Caller verification; assisted booking; staff availability; vehicles/drivers; assign, EnRoute/Completed; web notification; cash collection | A–C, driver availability, shared business services |
| E. Sau booking và hỗ trợ | Profile; general/trip enquiries/replies; amendments/cancel/refund queue; reviews | Booking state, finance ledger, email, journey completion |
| F. Insights và offers | Completed metrics; one-off recommendation/email; fully integrated redemption | Completed history, owner access, price/confirmation rules |
| G. Hoàn thiện | Regression, concurrency, desktop/mobile, print, persistent restart và hướng dẫn demo | Đủ 26 US và 140 AC |

Các phụ thuộc cần nhìn rõ:

- SCRUM-6 → SCRUM-7 → authenticated customer booking và owner-only features.
- SCRUM-10 + dữ liệu xe → SCRUM-12/SCRUM-13 → SCRUM-11, SCRUM-16, SCRUM-36.
- SCRUM-29 foundation cần tích hợp vào giá, initial confirmation và amendments; SCRUM-28 recommendation dùng lịch sử sau này.
- SCRUM-16/SCRUM-36 → Confirmed → SCRUM-26 → EnRoute → SCRUM-15; Completed → SCRUM-20/SCRUM-37/SCRUM-27/SCRUM-28.
- SCRUM-18/SCRUM-19 → refund workflow và SCRUM-17 payment/refund history.
- SCRUM-9 → SCRUM-24; SCRUM-21 + SCRUM-22 → SCRUM-23.

Không thực hiện theo thứ tự ID một cách máy móc. Không trì hoãn backend chỉ vì UI chưa đẹp nếu contract dữ liệu/AC đã thống nhất; wireframe cần trước phần UI tương ứng.

### 8.1 Thông tin Sprint trong báo cáo

Sprint 1 trong nguồn đã chọn SCRUM-6, 7, 10, 11, 12, 13, 14, 16, 17: **9 US, 34 points**. Báo cáo ghi 37 subtasks, 93 giờ/23.25 person-days với quy ước kế hoạch 1 person-day = 4 giờ. Đây không phải công thức đổi points sang giờ và không phải cấu hình mặc định 1 day của Jira.

SCRUM-29 là Must ngoài danh sách Sprint 1 nhưng là phụ thuộc nghiệp vụ của offer/payment. Phải làm rõ và hoàn thiện trước khi coi toàn bộ AC liên quan đạt; không vì mục tiêu MVP mà lờ phần offer đang có trong AC. Sprint 2/3 chưa có phạm vi đã chốt trong file hiện tại; không tự tuyên bố chúng đã được plan hoặc hoàn thành.

## 9. Kiểm thử và tiêu chí nghiệm thu

### 9.1 Quy trình kiểm tra

- Mỗi AC mục 12 cần một hoặc nhiều test case có điều kiện, dữ liệu, expected, actual, Pass/Fail/Not run và đường dẫn evidence.
- Có unit tests cho giá/overlap/24h/eligibility và integration tests cho backend + PostgreSQL/transaction/authorisation.
- Kiểm tra UI thực trên desktop và mobile; receipt browser print; refresh, sign-out/in và backend restart cho dữ liệu bền.
- Automated tests dùng email transport test hoặc local SMTP; không gửi thư thật hàng loạt. Real Gmail tests chỉ gửi tới hộp thư do nhóm kiểm soát khi leader chỉ định/cho phép.
- Không thử lỗi bằng cách tạo records trực tiếp rồi coi như UI/API tương ứng đã pass. Seed có thể chuẩn bị bối cảnh nhưng action cần test phải chạy thực.

### 9.2 Bộ kiểm thử nghiệp vụ tối thiểu

| Test group | Trường hợp phải bao phủ | US |
|---|---|---|
| Registration | Valid, missing fields, invalid/duplicate email khác hoa thường, confirm mismatch, supported mock refs, bcrypt hash, real email | 6 |
| Authentication | Correct/wrong password, anonymous access denied, spoof customer ID/role denied, owner A cannot read B, logout old-token/back/reload denied | 7 |
| Profile | Valid changes persist; duplicate/invalid update no mutation; new email login works; old email no longer sign-in identifier | 8 |
| Enquiry | Guest general; signed-in trip owner; cross-owner denied; no message/invalid email rejected; saved reference | 9 |
| Services | Sáu services; selection required; switch updates fare/duration and preserves common valid fields | 10 |
| Booking | Future pickup, integer passengers, capacity, valid ownership/channel/reference; Pending no reservation; details persist | 11 |
| Availability | Inactive/excess capacity/overlap excluded; adjacency accepted; Unpaid cash reserves; Pending doesn't; recheck concurrent confirmation | 12 |
| Pricing | Online 15% cho 3 methods; Telephone/In-person no online discount; valid offer after discount; zero floor/rounding; tampered client total ignored | 13 |
| Confirmation | Electronic/cash Confirmed email real with contact snapshot; Pending/failure no successful email; repeated action no duplicate application email event | 14 |
| Notification | EnRoute+driver+vehicle permitted; all other states rejected; owner access; signed-out receive later; duplicate prevented; message content+booking link | 15 |
| Payment | PayPal/card Success/Failed; VISA Check Fail prevents success; recheck period/fare/offer; rollback failed operation; repeat/concurrent initial payment | 16 |
| Receipt | Paid electronic/cash receipt; Unpaid cash amount due only; access, print, discount breakdown và refund history | 17 |
| Amend eligibility | 24h exactly accepted, below rejected, above accepted; owner/states; changing pickup does not bypass check on old pickup | 18 |
| Amend availability | Vehicle/service change; driver conflict when Assigned; exclude own reservation; failed edit retains old data | 18 |
| Amend finances | Unpaid no adjustment; Paid increase successful/failed top-up; decrease pending refund; same amount no adjustment; repeated edits policy mục 10 | 18 |
| Cancel/refund | Dismiss no change; paid/unpaid; resource release; one Pending including previous partial; Processed only once; netPaid cap; status Paid vs Refunded | 19 |
| Review | Completed owner only, Unpaid cash allowed; three integer ratings 1–5/text; one review; persisted links | 20 |
| Caller | Staff only; lookup email/phone; name/phone match/mismatch; new account; customer context cannot be forged for assisted booking | 21 |
| Staff availability | Vehicle/driver period, channel quote, no-results; search creates no reservation | 22 |
| Assisted booking | Verified/new customer; Telephone/In-person correct price; staff actor; electronic vs Cash; views agree | 23 |
| Reply | Staff only; non-empty reply saved with actor/time; actual email; failure not falsely answered; history | 24 |
| Fleet | Unique registration, valid capacity/status, no destructive edit of reserved commitments, historical links survive | 25 |
| Driver/journey | Valid driver, conflicting assignment rejected; no unavailable while assigned/enroute; correct state order; cash stays Unpaid when completed | 26 |
| Metrics | Completed counts incl Unpaid cash; other states excluded; counts sorted descending; empty list | 27 |
| Recommendation | 2 vs 3 Completed; one customer-linked recommendation; existing reused; real email; private configurable offer, no expiry | 28 |
| Redemption | Own/other/unknown/used code; one per booking; recheck stale code; no failed consumption; cash consumed once; amendments retain benefit; cancellation no restore | 29 |
| Cash confirm | Eligible Pending/Unpaid, same rechecks; Confirmed/Unpaid + reservation + email; no receipt before received | 36 |
| Cash collection | Staff-only Completed/Cash/Unpaid; full due from backend; actor/time; Paid with Completed; repeat/concurrent denied; receipt enabled | 37 |
| Durability | App/database restart retains business records and links; clean sessions handled safely; not just pg-mem/localStorage | All |

### 9.3 Ví dụ có số để kiểm tra

- Local journey/4 seats Online: £20 → online discount £3 → £17. Offer ví dụ £5 → £12. Cùng service qua Telephone/In-person: £20 trước offer.
- Airport transfer/7 seats Online: £65 − £9.75 = £55.25 trước offer. Cash và card cùng channel có cùng giá.
- Period A 10:00–11:00 và B 11:00–12:00: không overlap. B 10:59–11:59: overlap.
- Giả lập server clock trong test tại `T`; existing pickup `T+24h` đủ điều kiện; `T+23h59m59s` không đủ. Không phải đặt được 24h rồi mới sửa.
- Paid booking £17 cancel, chưa refund: Pending request £17. Process một lần → Refunded. Lần process thứ hai không thêm refund.
- Đã paid £50, processed refund £10 rồi cancel: netPaid còn £40, không refund lại £50.
- Completed/Cash/Unpaid vẫn tính loyalty và được review; chưa có paid receipt đến khi staff record collection.

### 9.4 Definition of Done cho sản phẩm

1. Đủ 26 US và 140 AC được kiểm tra hoặc có limitation ghi rõ; không báo hoàn chỉnh khi còn AC chưa làm.
2. Customer/staff UI, backend và PostgreSQL nối thực, dữ liệu qua reload/login/restart.
3. Access control thực tại backend; không truy cập chéo tài khoản hoặc tự cấp Staff bằng client.
4. Các nhánh success/failure, boundary 24h/overlap, concurrency và chống xử lý lặp đã kiểm tra.
5. Email thật cho đủ bốn luồng đã xác minh tới hộp thư nhóm kiểm soát; test payment/refund không chuyển tiền thật.
6. Desktop/mobile và print receipt dùng được; không có button bắt buộc chưa nối hoặc nhãn thành công giả.
7. Không lộ secrets; code cũ không bị ghi đè; mọi điểm tích hợp thay đổi được ghi rõ và được leader cho phép.
8. Có hướng dẫn khởi chạy, data/migrations/seed, tài khoản role test, test results và mapping AC → implementation/evidence.

## 10. Điểm cần chốt nếu gặp khi triển khai

Đây là các chi tiết chưa được AC/P mô tả đầy đủ. Không ghi chúng như yêu cầu đã có của CW. Antigravity có thể hoàn thành phần độc lập trước, rồi trình leader quyết định tối thiểu cho nhánh liên quan.

| Điểm | Đề xuất để leader xem xét |
|---|---|
| Nhiều lần amend Paid trong khi còn Pending partial refund | Dùng ledger netPaid và target fare hiện tại để cập nhật một pending request; khi tăng so với netPaid chỉ top-up phần thiếu; sau mỗi amend recompute refund outstanding. Xác nhận cách đối chiếu với cụm “higher revised total” trong AC trước khi chốt |
| Final fare = £0 do offer lớn | Cần quyết định confirmation/paid receipt cho zero-value booking mà không giả giao dịch ngân hàng. Giữ zero floor; không bỏ AC chỉ để tránh nhánh này |
| Xóa Pending booking khi pickup <24h | P05 hiện cấm cancel theo cùng cutoff. Không tự thêm delete/discard làm đường vòng; giữ đúng rule trừ khi leader chỉnh scope |
| Staff tạo account mới và password | Reuse các trường đăng ký; staff nhập thông tin test theo consent/contact được xác nhận. Không thêm password-reset/OTP flow hoặc email mật khẩu nếu không có quyết định mới |
| Unavailable driver/vehicle ở booking cũ | Có thể chặn cập nhật theo P06; không xóa record hoặc phá foreign keys. Hành động reassignment ngoài AC không tự phát triển lớn |
| Booking contact sau khi owner sửa email | Dùng snapshot trong booking cho confirmation theo P04. Profile email mới dùng login; không tự sửa lịch sử |
| Email thất bại sau lưu dữ liệu | Reuse cách partial-failure hiện có; đề xuất durable outbox/retry idempotent. Staff/leader cần cách kiểm tra và retry riêng, không bắt khách tạo lại |
| “Forgot password”/“Remember device” trong wireframe | Chỉ là tham khảo UI ngoài 26 AC. Cần leader xác nhận scope trước khi triển khai thực; không hiển thị nút chết trong bản demo cuối |
| Quy tắc password tối thiểu, phone/name matching | Giữ rule backend có sẵn nếu không mâu thuẫn AC; ghi rõ normalisation, không tự thêm validation quá chặt cho dữ liệu quốc tế |
| Dữ liệu offer pre-issued và one recommendation | Phân biệt seed codes dùng test với recommendation generated; không để một seed code vô tình làm customer mất eligibility khi báo cáo không mô tả |
| Số cuối thẻ demo khác nhau giữa thiết kế và code | Đồng bộ catalogue/seed/UI/test và ghi mapping; không dùng số thật. Đây là data fixture, không phải giới hạn business |

Không đòi hỏi tất cả người dùng duyệt mọi quyết định kỹ thuật thường lệ. Những mục trên chỉ cần chốt khi thay đổi hành vi nghiệp vụ hoặc xung đột với yêu cầu bảo toàn mã của nhóm.

## 11. Đầu ra Antigravity cần bàn giao

- Website hoàn chỉnh trong cấu trúc dự án đang có, chạy được bằng các lệnh rõ ràng.
- Migrations và seed tối thiểu, không mất dữ liệu cũ. Có khách/staff test, vehicles 4/7 seats, drivers, service fares chuẩn.
- Hướng dẫn cấu hình PostgreSQL và email không chứa secrets; chỉ rõ pg-mem và real Gmail khác nhau.
- Bảng mapping 26 US và từng AC tới screen/backend/model/test status; ghi các mục chưa chạy thật.
- Kiểm thử tự động trọng tâm và manual test records thực, với actual outcomes.
- Danh sách file thêm, file cần sửa và lý do; nguồn cũ được giữ/chỉnh tối thiểu đúng quyền đã duyệt.
- Checklist demo thực: account → book → payment/cash → confirmation → staff journey → notification → receipt → review → offer; nhánh amendments/cancel/refund và staff assistance/enquiry.
- Lưu bằng chứng phần mềm thật khi chạy. Không sửa báo cáo Word hoặc Jira, không ghi đã hoàn thành ba Sprint khi thực tế chưa diễn ra.
- Không in “all tests passed”, “fully secure”, “100% AC met” nếu chưa có kết quả kiểm tra tương ứng.

## 12. Toàn bộ User Stories và Acceptance Criteria từ Table 5

Các statement và AC tiếng Anh ở dưới giữ nội dung Table 5 của `6WHM.docx`. Tên US lấy từ Table 9. Story Points chỉ là metadata kế hoạch. Những lời giải thích và đề xuất ở các mục trên không được dùng để bỏ một AC bên dưới.

### SCRUM-6 — Register a customer account

**Priority:** Must Have (High). **Story Points:** 5.

**User story:** As a new customer, I want to register an account so that I can book journeys and keep my customer details.

- AC1: A customer can register using their name, email, address, telephone number, password and a selected mock card reference.
- AC2: Missing required information, an invalid email or an email already registered shows an error and prevents account creation.
- AC3: Card information uses the provided test-card choices and is displayed as a masked reference; no real card details are required.
- AC4: A valid registration saves an account that can be used to sign in.
- AC5: After successful registration, a confirmation email is sent to the registered email address.

### SCRUM-7 — Sign in and sign out as a customer

**Priority:** Must Have (High). **Story Points:** 3.

**User story:** As a registered customer, I want to sign in and sign out so that I can access my own booking functions.

- AC1: A registered customer can sign in using the correct email and password.
- AC2: Incorrect login details show an error and do not sign the customer in.
- AC3: Signing out ends access to protected customer pages.
- AC4: A visitor must sign in before submitting an online booking.
- AC5: Customers can access only their own protected profiles, bookings, payment details and receipts.

### SCRUM-8 — View and update customer profile details

**Priority:** Should Have (Medium). **Story Points:** 2.

**User story:** As a registered customer, I want to maintain my profile so that my contact and prototype payment details remain accurate.

- AC1: A signed-in customer can view their own contact details and masked mock card reference.
- AC2: The customer can update their contact details and select another provided mock card reference.
- AC3: Missing required information, an invalid email, an email used by another account or an unsupported mock card reference prevents saving and leaves the previous details unchanged.
- AC4: Saved changes remain visible after reloading, and an updated email becomes the customer's sign-in email.

### SCRUM-9 — Submit a general or trip-specific enquiry

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As a customer, I want to submit a general or trip-specific enquiry so that I can obtain help from PrivateHire Cars.

- AC1: The enquiry form offers General and Trip-specific enquiry types.
- AC2: A guest or signed-in customer can submit a general enquiry using a message and a valid reply email, without selecting a booking.
- AC3: A trip-specific enquiry requires a signed-in customer and one of their own bookings.
- AC4: Missing messages, invalid reply emails or another customer's booking show an error and prevent saving.
- AC5: A valid enquiry is saved with a reference number so staff can retrieve and answer it.

### SCRUM-10 — Choose a PrivateHire service

**Priority:** Must Have (High). **Story Points:** 2.

**User story:** As a customer, I want to choose the service I need so that my booking matches the purpose of my journey.

- AC1: Customers can select local journeys, long-distance journeys, airport transfers, hotel transfers, airport meet-and-greet or daily car-and-driver hire.
- AC2: A service must be selected before continuing to the booking review.
- AC3: Changing the service updates its sample base fare and journey duration while retaining valid common journey details.
- AC4: The selected service is saved with the booking and shown consistently to the customer and staff.

### SCRUM-11 — Submit an online journey booking

**Priority:** Must Have (High). **Story Points:** 5.

**User story:** As a signed-in customer, I want to submit my journey details so that I can request a suitable minicab.

- AC1: Only a signed-in customer can submit an online booking.
- AC2: The form requires a service, pickup location, destination, future pickup date/time, positive whole-number passenger count and suitable vehicle.
- AC3: Missing or invalid information, insufficient vehicle capacity or an unavailable vehicle prevents submission.
- AC4: A valid submission saves the booking under the customer's account with a reference, channel Online, booking status Pending and payment status Unpaid.
- AC5: The customer can view the saved journey details, fare and statuses in the booking details page.
- AC6: A Pending booking does not reserve a vehicle; the vehicle is reserved only after successful booking confirmation.

### SCRUM-12 — Check vehicle availability for a requested journey

**Priority:** Must Have (High). **Story Points:** 5.

**User story:** As a customer, I want to see available suitable vehicles so that I can select a vehicle that can fulfil my journey.

- AC1: The search shows only Active vehicles with enough passenger capacity.
- AC2: Availability uses the requested pickup time and the sample duration of the selected service. A vehicle cannot be selected if it has an overlapping Confirmed, Assigned or EnRoute booking, including an unpaid cash booking.
- AC3: A journey ending when another begins does not count as an overlap.
- AC4: If no suitable vehicle is available, the system displays a message and prevents an unavailable selection.
- AC5: Vehicle availability is checked again before confirming electronic-payment or cash bookings, and before saving an amendment.

### SCRUM-13 — Calculate the fare and the online booking discount

**Priority:** Must Have (High). **Story Points:** 3.

**User story:** As a customer, I want to see a clear calculated price so that I understand what I will pay before confirming.

- AC1: The backend calculates the base fare from the sample table using the selected service and vehicle capacity.
- AC2: Online bookings receive a 15% discount for card, PayPal and cash.
- AC3: Telephone and In-person bookings receive no automatic online discount.
- AC4: A valid offer deducts its stated discount amount after any online discount, and the final total cannot be negative. For example, a GBP 20 online booking becomes GBP 17 after the 15% discount; an example GBP 5 offer then reduces it to GBP 12.
- AC5: The booking review shows the base fare, discounts and final total in GBP to two decimal places. The saved total uses the backend calculation.

### SCRUM-14 — Receive and view booking confirmation

**Priority:** Must Have (High). **Story Points:** 3.

**User story:** As a customer, I want to receive a booking confirmation email and view my booking details so that I know my booking has been confirmed.

- AC1: Booking confirmation uses email automatically; the booking form does not require a notification-channel choice.
- AC2: When a booking becomes Confirmed, a real confirmation email is sent to the contact email saved with the booking, including for an unpaid cash booking.
- AC3: The email shows the booking reference, journey details, service and vehicle, total, payment method, payment status and any amount still due.
- AC4: A signed-in customer can view the same booking information in their own booking details.
- AC5: Pending bookings and failed payments do not produce a successful-booking confirmation email.
- AC6: Reprocessing the same booking confirmation does not create a duplicate confirmation email.

### SCRUM-15 — Receive an approaching-vehicle web notification

**Priority:** Should Have (Medium). **Story Points:** 5.

**User story:** As a customer, I want to receive an approaching-vehicle notification in my web account so that I can prepare for pickup and identify the correct vehicle.

- AC1: Authorised staff can select Notify customer only when the booking is EnRoute and has an assigned vehicle and driver.
- AC2: Sending the notification creates a message in the booking owner's Notifications page without requiring a notification-channel choice.
- AC3: The notification shows the booking reference, vehicle registration, make and colour, and states that the vehicle is expected in approximately 10-15 minutes. The manual trigger demonstrates this situation; no actual countdown or GPS connection is required.
- AC4: The customer can open the related booking from the notification. Customers can view only their own notifications and bookings.
- AC5: The notification is saved and remains available after reloading or signing in again, including when the customer was signed out when staff sent it.
- AC6: Pending, Confirmed, Assigned, Completed or Cancelled bookings, or bookings missing an assigned vehicle or driver, cannot create an approaching-vehicle notification.
- AC7: Repeating the action for the same booking does not create duplicate approaching-vehicle notifications.

### SCRUM-16 — Complete a simulated card or PayPal payment

**Priority:** Must Have (High). **Story Points:** 5.

**User story:** As a customer, I want to complete a simulated payment so that the prototype can demonstrate a paid booking.

- AC1: For a Pending, Unpaid booking, its owner can start payment; authorised staff can also process payment for a Telephone or In-person booking.
- AC2: The payment screen offers PayPal and example Visa, Mastercard and American Express cards, and clearly identifies the payment as a test payment.
- AC3: The simulation offers Success and Failed outcomes. The card path includes a VISA Check Pass/Fail result, and a Fail result prevents successful payment.
- AC4: Before success is saved, the system checks the future pickup time, backend fare, selected vehicle availability and any applied offer.
- AC5: Success records the payment, sets the booking to Confirmed and Paid, reserves the vehicle and marks an applied offer used. Failure displays an error and leaves the booking Pending and Unpaid without a reservation or offer use.
- AC6: A booking that is already confirmed, paid or cancelled cannot enter the initial payment flow again.

### SCRUM-17 — View and print a paid booking receipt

**Priority:** Must Have (High). **Story Points:** 3.

**User story:** As a paying customer, I want a printable receipt so that I have a record of my journey and final cost.

- AC1: The booking details page displays payment information for both electronic and cash bookings, including the total and current payment status.
- AC2: An unpaid cash booking shows the amount due and Unpaid status, without claiming that payment has been received.
- AC3: After a successful electronic payment or recorded cash collection, a receipt can be viewed from the booking details page.
- AC4: The receipt shows booking and payment references, journey details, payment method, discounts and the amount actually recorded as paid, and can be printed.
- AC5: Only the booking owner and authorised staff can access these details. Payment and refund records remain visible after reloading, including any pending refund or completed refund.

### SCRUM-18 — Amend an eligible booking

**Priority:** Should Have (Medium). **Story Points:** 8.

**User story:** As a customer, I want to amend an eligible booking so that I can update my journey plans.

- AC1: Only the owner can amend a Pending, Confirmed or Assigned booking when its existing pickup time is at least 24 hours away, including exactly 24 hours. EnRoute, Completed and Cancelled bookings cannot be amended.
- AC2: The customer can change journey details, service and vehicle. The revised pickup must be in the future and the passenger count must fit the selected vehicle.
- AC3: The selected vehicle must be available for the revised journey period. An Assigned booking must also have its current driver available for that period, excluding its own existing reservations from conflict checks.
- AC4: The system recalculates the fare from the sample table, keeps the original booking channel and any previously applied offer benefit, and shows the revised total before the customer confirms.
- AC5: For an Unpaid booking, a valid amendment updates the amount due without taking payment or creating a refund. A Pending booking remains Pending without a reservation; a confirmed cash booking keeps its booking state and updates its reservation.
- AC6: For a Paid booking with a higher total, the customer must successfully complete a test payment for the increase before the amendment is saved. A failed additional payment leaves the previous booking and paid amount unchanged.
- AC7: For a Paid booking with a lower total, the amendment creates or updates a Pending refund request for the decrease, for staff to process in the application. An unchanged total creates no payment adjustment.
- AC8: A successful amendment updates any reservations and retains the booking state. Invalid or conflicting changes leave the previous booking unchanged.

### SCRUM-19 — Cancel an eligible booking

**Priority:** Should Have (Medium). **Story Points:** 8.

**User story:** As a customer, I want to cancel an eligible booking so that I can withdraw a journey I no longer need.

- AC1: Only the owner can cancel a Pending, Confirmed or Assigned booking when its existing pickup time is at least 24 hours away, including exactly 24 hours. Other states or a shorter notice period block cancellation.
- AC2: The customer must confirm the cancellation; dismissing the confirmation leaves the booking unchanged.
- AC3: A successful cancellation immediately sets Cancelled, releases vehicle and driver reservations and prevents new approaching-vehicle web notifications. Previously stored notifications remain in the customer's history.
- AC4: If money remains to be refunded, cancellation creates or updates one Pending refund request for the remaining net amount paid. An Unpaid booking creates no refund request. An existing pending partial-refund request is updated rather than creating a second pending request.
- AC5: Authorised staff can view the refund queue, booking reference, reason, amount and request status, and confirm that a refund has been processed.
- AC6: Processing records the refund amount, time and staff member and marks the request Processed. A full refund for a Cancelled booking sets payment status Refunded; a partial refund for an active amended booking leaves payment status Paid.
- AC7: A Processed request cannot be processed again. The customer can see refund progress in the booking payment details.

### SCRUM-20 — Review a completed journey, vehicle and driver

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As a customer, I want to review and rate my completed journey, vehicle and driver so that I can share feedback about the service.

- AC1: Only the owner of a Completed booking can submit a review; Paid status is not required.
- AC2: The form requires review text and separate whole-number ratings from 1 to 5 for the journey, vehicle and driver.
- AC3: Missing, blank or invalid ratings/text show an error and prevent saving.
- AC4: A valid review is saved against the correct booking, customer, vehicle and driver and remains visible after reloading.
- AC5: Each booking accepts one review; another submission does not replace the saved review.

### SCRUM-21 — Verify callers and find or create customer accounts

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As a Call Centre staff member, I want to verify callers and locate or create their accounts so that I can assist the correct customer.

- AC1: Only authorised staff can access customer lookup and caller verification.
- AC2: Staff can find an existing account using its email or telephone number.
- AC3: For an existing customer, staff must match the supplied name and telephone number before proceeding; a failed check blocks assisted booking for that account.
- AC4: For a new customer, staff confirm the caller's contact details and create an account using the registration form.
- AC5: The selected or newly created customer account is passed to assisted booking.

### SCRUM-22 — View vehicle and driver availability as staff

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As a Call Centre staff member, I want to see available minicabs, drivers and prices so that I can give customers accurate booking information.

- AC1: Only authorised staff can open the staff availability view.
- AC2: Searching by pickup time, service and passenger count shows suitable vehicles and driver availability for the sample journey duration.
- AC3: Unavailable resources and conflicting reservations are excluded or clearly identified. Drivers are busy for overlapping Assigned or EnRoute bookings.
- AC4: The view shows the sample fare for the selected channel, without an automatic online discount for Telephone or In-person.
- AC5: Empty results are clearly shown, and an available vehicle and quote can be passed to assisted booking without reserving resources at the search stage.

### SCRUM-23 — Create a telephone or in-person booking as staff

**Priority:** Should Have (Medium). **Story Points:** 5.

**User story:** As a Call Centre staff member, I want to create a booking for a verified customer so that telephone and in-person customers can use the service.

- AC1: Authorised staff can create a Telephone or In-person booking for a selected customer account.
- AC2: The customer context comes from a successful existing-caller check or account creation in SCRUM-21, and the form captures the required journey details.
- AC3: Submission checks vehicle capacity and availability and calculates the fare without an automatic online discount.
- AC4: A valid submission saves a Pending, Unpaid booking with the correct customer, channel, staff member and booking reference.
- AC5: Staff can confirm the booking using the shared electronic test-payment or cash-confirmation flow: electronic success produces Confirmed/Paid; cash produces Confirmed/Unpaid. Both reserve the vehicle and trigger the confirmation email.
- AC6: Customer and staff views show the same saved booking details, totals and payment statuses.

### SCRUM-24 — Reply to customer enquiries as staff

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As a Call Centre staff member, I want to reply to customer enquiries so that customers receive help about services or journeys.

- AC1: Authorised staff can view enquiries, their original messages, reply contacts and any linked booking.
- AC2: Staff can save a non-empty reply with the staff member and reply time.
- AC3: The reply is sent by email to the enquiry's reply email address.
- AC4: An empty reply or failed save shows an error without marking the enquiry answered.
- AC5: Saved replies remain available after reloading.

### SCRUM-25 — Add and maintain minicab records as staff

**Priority:** Should Have (Medium). **Story Points:** 5.

**User story:** As an authorised staff member, I want to maintain minicab records so that bookings use accurate vehicle information.

- AC1: Only authorised staff can add or update vehicle records.
- AC2: A vehicle record contains a unique registration, make, colour, capacity of 4 or 7 and Active/Unavailable status.
- AC3: Missing required information, a duplicate registration or an invalid capacity shows an error and prevents saving.
- AC4: Saved vehicle details remain after reloading, and availability searches reflect valid changes.
- AC5: Updates keep existing booking links intact and cannot reduce capacity below an active booking's passenger count or make its reserved vehicle unavailable.

### SCRUM-26 — Maintain driver records and demonstrate journey states

**Priority:** Should Have (Medium). **Story Points:** 5.

**User story:** As an authorised staff member, I want to maintain driver availability and journey assignments so that I can manage a booked journey.

- AC1: Only authorised staff can add and update driver records containing a name, telephone number, unique driver reference and Active/Unavailable status.
- AC2: Only an Active driver without a conflicting Assigned/EnRoute reservation can be assigned to a Confirmed booking, including an unpaid cash booking.
- AC3: Assigning a driver records the assignment and staff member and changes the booking to Assigned.
- AC4: Staff can use journey simulation controls to move Assigned to EnRoute with a vehicle and driver, and then to Completed, in that order, without waiting for real journey time.
- AC5: Completing a journey does not automatically mark an unpaid cash booking as Paid.
- AC6: Saved driver details and assignments remain after reloading; a driver with an Assigned or EnRoute booking cannot be marked Unavailable.

### SCRUM-27 — View popular vehicles and loyal customers

**Priority:** Could Have (Low). **Story Points:** 2.

**User story:** As an authorised staff member, I want to see popular vehicles and loyal customers so that I can identify useful service and offer opportunities.

- AC1: Only authorised staff can view the vehicle-popularity and customer-loyalty lists.
- AC2: Vehicle popularity is the count of all stored Completed bookings for each vehicle.
- AC3: Customer loyalty is the count of all stored Completed bookings for each customer, including completed cash journeys that remain Unpaid. Other booking states are excluded from both lists.
- AC4: Results are ordered by count descending and show an empty state when no results exist.

### SCRUM-28 — Recommend a special offer from customer history

**Priority:** Could Have (Low). **Story Points:** 3.

**User story:** As a customer, I want a relevant special-offer recommendation so that I can benefit from using PrivateHire Cars again.

- AC1: Opening the signed-in customer's Offers page creates a recommendation only when the customer has at least three Completed bookings and has not received a recommendation before.
- AC2: The recommendation displays a customer-linked offer code and its configured discount amount, for example GBP 5 or GBP 10. These amounts are examples, not fixed limits; the code has no expiry date in this prototype.
- AC3: The offer appears in the customer's account and a recommendation email is sent to that customer.
- AC4: Reopening the page displays the existing recommendation instead of creating another one.
- AC5: Only the linked customer can access and use the private offer, and it can be redeemed for one confirmed booking.

### SCRUM-29 — Apply a special-offer code to the next booking

**Priority:** Must Have (High). **Story Points:** 5.

**User story:** As a customer, I want to enter my special-offer code when booking so that I can redeem my eligible offer.

- AC1: A customer, or staff assisting that customer, can enter an offer code when reviewing a booking.
- AC2: A newly applied code must exist, belong to the booking customer and be unused. An invalid code shows an error and applies no offer discount.
- AC3: A valid code deducts the amount specified by the offer after any online discount, for every booking channel and payment method. For example, an offer may deduct GBP 5 or GBP 10; the final total cannot be negative.
- AC4: Each booking accepts at most one code and displays its revised total before confirmation. If an applied code is no longer valid at confirmation, the customer must review the corrected total before continuing.
- AC5: The code is marked used only when the booking successfully becomes Confirmed through electronic payment or cash confirmation. Failed confirmation does not use the code, and later cash collection does not use it again.
- AC6: An eligible amendment keeps the discount amount already applied to that booking. Cancellation does not make a used code available again.

### SCRUM-36 — Confirm a booking with cash payment

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As a customer, I want to confirm a booking with cash payment so that I can pay at the end of my journey.

- AC1: The booking owner, or authorised staff assisting a Telephone/In-person booking, can select Cash for a Pending, Unpaid booking.
- AC2: Confirmation checks the future pickup time, backend fare, vehicle availability and any applied offer. Failed checks leave the booking Pending and Unpaid without a reservation or offer use.
- AC3: Successful confirmation records method Cash, sets Confirmed and Unpaid, reserves the vehicle and marks any valid applied offer used. Online cash bookings retain the 15% discount.
- AC4: The booking details show the amount due at the end of the journey, and the shared booking-confirmation email is sent.
- AC5: Cash confirmation does not create a paid receipt; it becomes available only after staff record receipt of cash.

### SCRUM-37 — Record a cash payment as staff

**Priority:** Should Have (Medium). **Story Points:** 3.

**User story:** As an authorised staff member, I want to record a cash payment for a completed booking so that its payment status and receipt reflect the amount received.

- AC1: Only authorised staff can record cash received for a Completed, Cash, Unpaid booking.
- AC2: The system displays the full amount due, and staff confirm receipt using a Confirm cash received button without typing the amount again.
- AC3: The system saves the payment amount, method, time and staff member, sets payment status Paid and retains booking status Completed. This is a recorded test transaction in the prototype.
- AC4: A printable paid receipt becomes available in the booking details page.
- AC5: A booking already marked Paid cannot produce another cash-collection record.

## 13. Nguồn và kiểm tra độ bao phủ

- Nguồn chính: `6WHM.docx`, bản đọc ngày 8 November 2026; 13 bảng và 66 tài nguyên ảnh nhúng. Nội dung nghiệp vụ trích từ các mục được nêu ở đầu tài liệu; không OCR các screenshot để suy ra yêu cầu mới.
- SHA-256 của bản Word nguồn: `6101106a25d72e7e2d62324671212e9c0cca46ffe4d42f2b100c6a1be834de85`.
- Đã đối chiếu đủ 14 requirements, 5 Epics, 26 user stories, 140 AC, P01–P09 và đủ 6 dòng giá mẫu.
- Đã tính lại 103 Story Points từ các dòng Table 5 và 34 points cho 9 US Sprint 1. Không dùng tổng 86 lỗi thời trong đoạn dẫn.
- Kiểm tra mã nguồn chỉ dùng để nhận diện kiến trúc, tái sử dụng và khoảng trống. Không chạy website hoặc kiểm thử Gmail/PostgreSQL trong quá trình tạo tài liệu này; không suy ra độ hoàn thành hiện tại.
- Những quyết định ở mục 10 và đề xuất kiến trúc/API/schema không phải yêu cầu nguyên văn CW. Khi chốt khác, ghi quyết định và điều chỉnh tài liệu/AC có liên quan với leader.
- Tài liệu này không chứa Gmail App Password, session token hay credential thực của nhóm.
