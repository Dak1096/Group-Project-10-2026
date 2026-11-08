# Phân tích nghiệp vụ frontend website học ngoại ngữ ứng dụng Adaptive Learning và Gamification

## 1. Định vị và nguyên tắc phân tích

Website học ngoại ngữ kết hợp Adaptive Learning (điều chỉnh độ khó theo năng lực) và Gamification (cơ chế trò chơi hóa) đặt frontend vào một vị trí đặc biệt: đây là nơi hai hệ thống động lực gặp nhau và có thể triệt tiêu lẫn nhau nếu không được thiết kế nghiệp vụ chặt chẽ.

- **Adaptive Learning** muốn người dùng ở vùng phát triển gần nhất — nghĩa là phải chấp nhận sai khoảng 15–30%, tức là trải nghiệm thất bại có chủ đích.
- **Gamification** muốn người dùng cảm thấy thành công thường xuyên — streak, XP, huy hiệu, bảng xếp hạng đều dựa trên phần thưởng.

**Mâu thuẫn cốt lõi cần giải quyết:** nếu adaptive làm khó hơn, người dùng mất streak và bỏ cuộc; nếu gamification thưởng quá dễ, adaptive mất tín hiệu chính xác. Frontend là nơi phải biểu đạt sự cân bằng này thành hành vi nhìn thấy được.

**Nguyên tắc phân tích:**

1. Frontend sở hữu trạng thái hiển thị và phản hồi tức thời; không sở hữu trạng thái nghiệp vụ gốc (tiến độ, XP, độ khó đều do backend quyết định).
2. Mọi phần thưởng gamification phải truy vết được nguồn (hoạt động nào, quy tắc nào), không có XP “tự nhiên xuất hiện”.
3. Adaptive phải giải thích được trên UI, gamification phải không khuyến khích hành vi phá tín hiệu adaptive (ví dụ nhấn bừa để lấy XP).
4. Frontend phải chịu được điều kiện thực tế thị trường Việt Nam: mạng di động không ổn định, thiết bị cấu hình thấp, đa thiết bị, đăng nhập social (Google/Facebook/Zalo).

---

## 2. Bản đồ hành trình người học và điểm chạm frontend

| Giai đoạn | Màn hình/hành vi chính | Tương tác Adaptive | Tương tác Gamification | Rủi ro nghiệp vụ |
|---|---|---|---|---|
| Khám phá | Trang chủ, chi tiết khóa, bảng giá | Hiển thị lộ trình dự kiến theo trình độ | Hiển thị huy hiệu/level đạt được (nếu có) | Hứa hẹn lộ trình không khớp định cấp thực tế |
| Đăng ký/Đăng nhập | Form, social login, OTP | Lưu kết quả định cấp vào tài khoản | Gắn tài khoản với streak/XP cũ khi liên kết | Tạo tài khoản trùng → mất streak, mất XP |
| Định cấp | Bài test đầu vào | Kết quả ánh xạ vào mô hình năng lực | Thưởng XP hoàn thành định cấp (không thưởng theo điểm) | Thưởng theo điểm cao → người dùng cố tình làm sai/đúng để farm |
| Học bài | Trình phát bài học, bài tập | Câu hỏi theo độ khó cá nhân | XP theo hoạt động, streak ngày | Mất tiến độ khi mất mạng → mất streak oan |
| Luyện tập Adaptive | Câu hỏi động, nút “quá dễ/quá khó” | Ghi đè độ khó, tín hiệu `response_time` | XP/coin theo câu đúng, combo | Farm XP bằng cách nhấn “quá dễ” liên tục |
| Kiểm tra/Đánh giá | Bài kiểm tra cuối unit | Điều chỉnh unit tiếp theo | Huy hiệu chứng nhận, bảng xếp hạng | Xếp hạng theo điểm tuyệt đối → người học yếu bị demotivate |
| Nhiệm vụ/Thử thách | Daily quest, weekly challenge | Nhiệm vụ phải tương thích độ khó cá nhân | Phần thưởng, streak freeze | Nhiệm vụ cố định không phù hợp trình độ → bỏ cuộc |
| Thanh toán | Chọn gói, voucher, chuyển kênh | (Không liên quan) | Gói premium mở khóa tính năng gamification | Hiển thị “thành công” khi chưa xác nhận |
| Hồ sơ/Thành tích | Tiến độ, XP, huy hiệu, lịch sử | Hiển thị năng lực định tính theo kỹ năng | Bộ sưu tập huy hiệu, level, streak | Hiển thị điểm năng lực thô gây trải nghiệm tiêu cực |

---

## 3. Phân tích nghiệp vụ theo nhóm màn hình

### 3.1 Trang chủ và trang chi tiết khóa học

**Câu hỏi nghiệp vụ cần chốt:**

- Lộ trình dự kiến hiển thị trên trang bán có được cá nhân hóa theo định cấp không, hay chỉ là lộ trình mẫu? Nếu cá nhân hóa, cần đăng nhập trước khi xem — ảnh hưởng đến phễu chuyển đổi.
- Gamification hiển thị ở đâu trên trang bán? Huy hiệu/level của người dùng hiện tại có nên xuất hiện để tạo cảm giác tiến bộ, hay ẩn để tránh phân tâm khỏi CTA mua?
- Với gói premium mở khóa tính năng gamification (ví dụ bảng xếp hạng, streak freeze), phải hiển thị rõ tính năng nào miễn phí, tính năng nào trả phí ngay trên bảng giá.

**Yêu cầu chức năng:**

- Giá và gói lấy từ backend, không hard-code; hiển thị rõ chu kỳ subscription, ngày trừ tiền tiếp theo, cách hủy.
- Trạng thái “đã sở hữu” thay thế nút mua, có CTA vào học ngay.
- Nếu người dùng đã có streak/XP từ tài khoản cũ, sau khi đăng nhập phải hiển thị nhất quán (không reset về 0).

### 3.2 Đăng ký, đăng nhập và liên kết tài khoản

Đặc thù quan trọng với gamification: streak và XP là tài sản tâm lý. Mất streak do tạo tài khoản trùng là nguyên nhân rời bỏ phổ biến.

**Yêu cầu nghiệp vụ:**

- Hỗ trợ đăng nhập social (Google/Facebook/Zalo) + OTP số điện thoại; khi phát hiện email/SĐT đã tồn tại, bắt buộc đề nghị liên kết tài khoản thay vì tạo mới.
- Khi liên kết, phải hiển thị rõ: streak hiện tại, XP, huy hiệu nào sẽ được giữ, có xung đột dữ liệu nào không (ví dụ hai tài khoản đều có streak).
- Định nghĩa quy tắc hợp nhất: streak lấy giá trị cao hơn hay theo tài khoản chính? XP cộng dồn hay lấy max? Đây là quyết định nghiệp vụ, không phải kỹ thuật.

### 3.3 Định cấp (Placement Test)

Tương tác với gamification — điểm dễ sai nhất:

- **Không thưởng XP theo điểm số định cấp.** Nếu thưởng theo điểm cao, người dùng có động cơ làm đúng bằng mọi giá (tra cứu, đoán mò) làm nhiễu mô hình năng lực. Khuyến nghị: thưởng XP cố định khi hoàn thành bài định cấp, bất kể kết quả.
- Kết quả định cấp hiển thị định tính (“Bạn bắt đầu ở lộ trình Nền tảng vững”), không hiển thị điểm thô.
- Sau định cấp, hiển thị lộ trình dự kiến và phần thưởng chào mừng (huy hiệu “Khởi đầu”, XP khởi động) để tạo động lực ngay từ đầu.

### 3.4 Trình phát bài học (Learning Player)

Đây là màn hình phức tạp nhất, nơi adaptive và gamification tương tác liên tục.

**Các quyết định nghiệp vụ cần chốt:**

| Vấn đề | Lựa chọn | Khuyến nghị |
|---|---|---|
| Lưu tiến độ | Theo giây / theo hoạt động / theo lần hoàn thành | Lưu theo hoạt động, đánh dấu hoàn thành khi đạt ngưỡng; tránh spam API |
| Mất mạng giữa bài | Chặn học / lưu tạm / offline | Lưu nháp local, đồng bộ idempotent; banner offline rõ ràng |
| Streak khi mất mạng | Mất streak / giữ streak / streak freeze tự động | Không phạt oan: nếu hoạt động đã hoàn thành local và đồng bộ trong 24h, vẫn tính streak |
| Nộp bài trùng | Cho phép / chặn / idempotent | Dùng `attempt_id` backend cấp, disable nút sau lần bấm đầu |
| XP hiển thị tức thời | Hiện ngay / chờ backend / optimistic | Hiển thị optimistic với animation, nhưng có cơ chế rollback nếu backend từ chối (ví dụ phát hiện gian lận) |
| Combo/streak trong phiên | Tính theo câu đúng liên tiếp | Hiển thị combo, nhưng không dùng combo để điều chỉnh adaptive — tránh khuyến khích đoán mò |

**Trạng thái màn hình phải định nghĩa đầy đủ:** đang tải, đang học, tạm dừng, mất mạng, lỗi tải nội dung, hết thời gian, hoàn thành, bị khóa do chưa mua/gia hạn, đang đồng bộ phần thưởng.

### 3.5 Luyện tập Adaptive trên frontend

Frontend không tính adaptive, nhưng phải truyền đúng tín hiệu và không để gamification phá tín hiệu.

**Yêu cầu nghiệp vụ:**

- Mỗi câu trả lời gửi kèm: `item_id`, `attempt_id`, `correct`, `response_time`, `hint_used`, `client_timestamp`. Thiếu `response_time` chính xác làm nhiễu mô hình năng lực.
- Nút “quá dễ/quá khó” phải có debounce + giới hạn tần suất (ví dụ tối đa 2 lần/giờ) và không thưởng XP cho hành động này — nếu thưởng, người dùng sẽ nhấn bừa để farm.
- Lý do gợi ý (“Dựa trên 10 câu gần đây…”) lấy từ backend, không tự sinh ở frontend.
- Khi backend không trả về quyết định adaptive (lỗi/timeout), frontend hiển thị câu theo thứ tự mặc định và không hiển thị lý do gợi ý — tránh nói dối người dùng.
- **XP theo độ khó, không theo số câu:** câu khó hơn (theo quyết định adaptive) thưởng XP cao hơn, để người dùng có động cơ chấp nhận thử thách thay vì chọn dễ. Đây là quyết định nghiệp vụ quan trọng để hai hệ thống cộng hưởng thay vì triệt tiêu.

### 3.6 Kiểm tra, đánh giá và bảng xếp hạng

**Câu hỏi nghiệp vụ then chốt:**

- Bảng xếp hạng theo điểm tuyệt đối hay theo tiến bộ so với bản thân? Xếp hạng tuyệt đối khiến người học yếu bỏ cuộc; khuyến nghị có hai bảng: một theo tuần (tuyệt đối, giới hạn trong nhóm cùng trình độ) và một theo tiến bộ cá nhân.
- Huy hiệu chứng nhận hoàn thành unit: cấp theo hoàn thành + đạt ngưỡng năng lực, không chỉ theo điểm bài kiểm tra.
- Kết quả kiểm tra hiển thị định tính theo kỹ năng (“Nghe: vững”, “Nói: cần luyện thêm”), không hiển thị điểm năng lực thô.
- Nếu người dùng làm lại bài kiểm tra, phải định nghĩa: có cộng XP lần nữa không? Khuyến nghị không cộng XP trùng cho cùng một bài, nhưng vẫn cập nhật mô hình năng lực.

### 3.7 Nhiệm vụ, thử thách và streak

Đây là trái tim của gamification, và là nơi dễ xung đột với adaptive nhất.

**Yêu cầu nghiệp vụ:**

- **Daily quest phải thích ứng độ khó:** nhiệm vụ “hoàn thành 3 bài học” cố định có thể quá khó với người mới hoặc quá dễ với người giỏi. Khuyến nghị nhiệm vụ dạng “hoàn thành X hoạt động ở độ khó phù hợp” thay vì con số cố định.
- **Streak freeze:** định nghĩa rõ số lượng miễn phí, số lượng mua bằng coin, và cách hiển thị trên UI. Nếu streak freeze là tính năng premium, phải hiển thị minh bạch trước khi người dùng mất streak.
- **Thông báo mất streak:** phải có màn hình/email nhắc trước khi mất (ví dụ còn 4 giờ), không để người dùng phát hiện streak về 0 mà không biết lý do.
- Nhiệm vụ không được khuyến khích hành vi phá adaptive: không có nhiệm vụ “trả lời 50 câu trong 5 phút” vì sẽ khuyến khích đoán mò.
- Phần thưởng phải truy vết được: mỗi XP/coin/huy hiệu hiển thị kèm nguồn (“từ Daily Quest 12/03”, “từ Unit 3 hoàn thành”).

### 3.8 Luồng thanh toán trên frontend

**Nguyên tắc bất di bất dịch:** frontend không bao giờ coi việc quay về `return_url` là bằng chứng thanh toán thành công.

**Yêu cầu nghiệp vụ:**

- Sau khi quay về, hiển thị “đang xác nhận thanh toán” và poll API trạng thái đơn (giới hạn số lần, khoảng cách), đến khi nhận SUCCESS/FAILED/PENDING quá hạn.
- Nếu người dùng đóng tab trước khi quay về, khi mở lại website phải có cơ chế kiểm tra đơn đang chờ.
- Với subscription, sau khi thành công phải hiển thị ngày trừ tiền kỳ tiếp theo và link quản lý/hủy ngay trên màn hình xác nhận.
- Phần thưởng mua hàng (nếu có, ví dụ “mua gói năm tặng 500 XP”) phải hiển thị rõ trước khi thanh toán và cộng sau khi backend xác nhận, không cộng lạc quan trước khi có xác nhận.
- Voucher: hiển thị số tiền giảm và số tiền cuối cùng; nếu voucher không hợp lệ tại thời điểm thanh toán, quay lại bước chọn voucher với thông báo cụ thể, không tự động bỏ im lặng.

### 3.9 Hồ sơ, thành tích và quản lý subscription

**Yêu cầu nghiệp vụ:**

- Trang tiến độ hiển thị theo đơn vị nghiệp vụ (unit/bài/kỹ năng), không chỉ phần trăm chung.
- Bộ sưu tập huy hiệu: hiển thị huy hiệu đã đạt, chưa đạt (kèm điều kiện), và huy hiệu sắp hết hạn (nếu có).
- Không hiển thị điểm năng lực thô; hiển thị định tính theo kỹ năng, kèm gợi ý cải thiện.
- Hủy subscription: màn hình xác nhận nêu rõ hiệu lực đến khi nào, có mất quyền truy cập ngay không, có hoàn tiền không, và các phần thưởng gamification nào sẽ mất (ví dụ streak freeze premium, bảng xếp hạng).
- Trạng thái “sắp hết hạn” hiển thị trước ngày hết hạn theo cấu hình (ví dụ 7 ngày), có CTA gia hạn.

---

## 4. Ma trận tương tác Adaptive × Gamification (phần quan trọng nhất)

| Tình huống | Adaptive quyết định | Gamification phản ứng | Yêu cầu frontend |
|---|---|---|---|
| Người dùng làm đúng liên tiếp | Tăng độ khó 1 cấp | Combo/XP tăng theo độ khó mới | Hiển thị “Thử thách mới” + XP cao hơn, giải thích ngắn |
| Người dùng làm sai liên tiếp | Giảm độ khó 1 cấp | Không phạt XP, có thể thưởng “nỗ lực” nhỏ | Hiển thị động viên, không hiển thị “bạn đang tụt lại” |
| Người dùng nhấn “quá dễ” | Tăng độ khó ngay | Không thưởng XP cho hành động này | Nút có giới hạn tần suất, không có animation phần thưởng |
| Người dùng mất streak do mạng | (Không liên quan) | Streak freeze tự động nếu hoạt động đã hoàn thành local | Banner “streak được bảo vệ”, giải thích rõ |
| Nhiệm vụ ngày quá khó với người mới | (Không liên quan) | Nhiệm vụ thích ứng độ khó | Hiển thị nhiệm vụ theo độ khó cá nhân, không hiển thị con số cố định |
| Người dùng học lại bài cũ | Không đổi độ khó | Không cộng XP trùng | Hiển thị “ôn tập”, không có animation XP |

---

## 5. Yêu cầu phi chức năng đặc thù frontend

| Loại | Yêu cầu |
|---|---|
| Hiệu năng | Trang chi tiết khóa LCP < 2.5s trên 4G; trình phát bài học bắt đầu trong < 3s hoặc skeleton rõ ràng; animation phần thưởng không chặn luồng học |
| Khả dụng mạng yếu | Lưu nháp local cho bài học/bài tập; trạng thái offline rõ ràng; không mất dữ liệu khi chuyển Wi-Fi ↔ 4G; đồng bộ lại phần thưởng khi có mạng |
| Đa thiết bị | Cùng tài khoản hai thiết bị: định nghĩa hành vi (phiên mới đẩy phiên cũ về chỉ đọc, không nộp trùng); streak tính theo múi giờ nào phải chốt |
| Múi giờ và streak | Streak tính theo múi giờ người dùng hay múi giờ hệ thống? Phải chốt và hiển thị rõ (“streak reset lúc 00:00 giờ Việt Nam”) |
| Khả năng truy cập | Phụ đề video, điều khiển bàn phím, tương phản WCAG AA; animation phần thưởng có tùy chọn giảm chuyển động |
| Bảo mật | Không lưu token dài hạn trong localStorage nếu có thể dùng cookie httpOnly; che SĐT/email trong log; chống farm XP phía client (backend là nguồn xác thực cuối) |
| Đo lường | Event tracking cho từng bước phễu, từng tương tác gamification (nhận XP, mất streak, nhấn “quá dễ”), và từng quyết định adaptive hiển thị |

---

## 6. Các quyết định nghiệp vụ cần chốt (danh sách cần xác nhận)

1. **Định nghĩa “hoàn thành bài học”:** đạt bao nhiêu % hoạt động, có tính thời gian tối thiểu, có tính bài kiểm tra cuối? Ảnh hưởng trực tiếp đến tiến độ hiển thị, điều kiện mở khóa, và điều kiện tính streak.
2. **Streak tính theo múi giờ nào:** người dùng Việt Nam nhưng học ban đêm, hoặc người dùng ở nước ngoài — cần chốt trước khi thiết kế UI.
3. **XP theo độ khó hay theo số câu:** đây là quyết định quyết định hai hệ thống cộng hưởng hay triệt tiêu. Khuyến nghị XP theo độ khó để khuyến khích chấp nhận thử thách.
4. **Bảng xếp hạng tuyệt đối hay theo tiến bộ:** khuyến nghị cả hai, nhưng bảng tuyệt đối giới hạn trong nhóm cùng trình độ.
5. **Hiển thị điểm năng lực adaptive:** có cho người dùng thấy điểm định lượng không, hay chỉ định tính? Khuyến nghị định tính.
6. **Chính sách streak khi mất mạng hoặc lỗi hệ thống:** có bảo vệ streak tự động không, trong bao lâu? Cần chính sách rõ và hiển thị minh bạch.
7. **Tính năng gamification nào thuộc premium:** streak freeze, bảng xếp hạng, huy hiệu đặc biệt — phải hiển thị rõ trên bảng giá và trong màn hình hủy subscription.
8. **Hành vi khi mất mạng giữa bài kiểm tra có giới hạn thời gian:** tạm dừng đồng hồ hay tiếp tục chạy? Nếu tiếp tục, người dùng mạng yếu bị phạt oan.
9. **Đa thiết bị đồng thời:** cho phép học song song hay chỉ một phiên hoạt động? Ảnh hưởng đến thiết kế trạng thái và xử lý xung đột tiến độ/XP.
10. **Ngôn ngữ và bản địa hóa:** website phục vụ người Việt học ngoại ngữ, hay người nước ngoài học tiếng Việt? Quyết định chiều RTL/LTR, định dạng số/ngày, và cách hiển thị phiên âm.

---

## 7. Rủi ro nghiệp vụ điển hình nếu frontend làm thiếu

| Rủi ro | Hậu quả | Biện pháp nghiệp vụ |
|---|---|---|
| Thưởng XP theo điểm định cấp | Người dùng làm sai/đúng có chủ đích để farm → mô hình năng lực sai | Thưởng XP cố định khi hoàn thành, không theo điểm |
| Nút “quá dễ/quá khó” có thưởng XP | Farm tín hiệu, adaptive sai cho nhiều người | Không thưởng XP, giới hạn tần suất, ghi log nguồn |
| Mất streak do mất mạng | Rời bỏ ngay lập tức | Lưu nháp local + đồng bộ idempotent + streak bảo vệ |
| Hiển thị “thanh toán thành công” dựa trên `return_url` | Khiếu nại, hoàn tiền thủ công | Chỉ hiển thị thành công sau khi poll API xác nhận |
| Hủy subscription không phản ánh ngay | Tranh chấp trừ tiền kỳ tiếp theo | Cập nhật lạc quan + xác nhận backend + thông báo |
| Bảng xếp hạng tuyệt đối toàn hệ thống | Người học yếu bỏ cuộc | Chia nhóm cùng trình độ + bảng tiến bộ cá nhân |
| Nhiệm vụ cố định không theo trình độ | Người mới bỏ cuộc, người giỏi nhàm chán | Nhiệm vụ thích ứng độ khó |
| Đăng nhập social tạo tài khoản mới | Mất streak, mất XP, mất khóa đã mua | Cơ chế liên kết tài khoản bắt buộc khi trùng email/SĐT |

---

## 8. Đề xuất cấu trúc tài liệu frontend cho đội phát triển

Nên tách tài liệu frontend thành bốn lớp, tránh viết một file quá dài không ai đọc:

1. **Sơ đồ luồng màn hình (screen flow) kèm trạng thái:** mỗi màn hình có danh sách trạng thái (loading/empty/error/offline/syncing-reward/success) và điều kiện chuyển.
2. **Đặc tả hành vi theo sự kiện:** bảng “người dùng làm gì → frontend gọi API nào → hiển thị gì → xử lý lỗi thế nào → phần thưởng nào được hiển thị/rollback”. Đây là phần kỹ sư frontend đọc nhiều nhất.
3. **Ma trận tương tác Adaptive × Gamification:** bảng ở mục 4, mở rộng theo từng màn hình.
4. **Ma trận phân quyền hiển thị:** theo trạng thái tài khoản (chưa đăng nhập, đã đăng nhập chưa mua, đã mua còn hạn, đã mua hết hạn, subscription đang hoạt động, đã hủy, premium vs free), mỗi thành phần UI hiển thị/ẩn/khóa như thế nào.

---

## Kết luận

Với website học ngoại ngữ kết hợp adaptive và gamification, giá trị lớn nhất của phân tích frontend không nằm ở việc liệt kê màn hình, mà ở việc chốt trước các định nghĩa nghiệp vụ mơ hồ và các xung đột động lực — “hoàn thành”, “thành công”, “hủy”, “quá dễ”, “streak bị mất”, “XP được thưởng” — và biến chúng thành trạng thái hiển thị có thể kiểm thử.

Nếu các định nghĩa này không được chốt ở giai đoạn phân tích nghiệp vụ, chúng sẽ được chốt ngẫu nhiên bởi lập trình viên frontend, và chi phí sửa sau khi ra mắt cao hơn nhiều lần — đặc biệt nguy hiểm khi sai lầm trong gamification có thể phá hủy tín hiệu adaptive mà không ai phát hiện cho đến khi dữ liệu mô hình đã nhiễu.
