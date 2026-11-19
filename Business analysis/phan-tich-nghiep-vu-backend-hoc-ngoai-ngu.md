# Phân tích nghiệp vụ backend website học ngoại ngữ ứng dụng Adaptive Learning và Gamification

## 1. Định vị và nguyên tắc phân tích

Backend của website học ngoại ngữ kết hợp Adaptive Learning và Gamification không phải là “nơi lưu dữ liệu” hay “nơi chứa API”. Backend là nơi hai hệ thống động lực được tính toán và phân xử: adaptive quyết định độ khó, gamification quyết định phần thưởng, và backend phải đảm bảo hai hệ thống này không phá tín hiệu của nhau trong khi vẫn đảm bảo tính đúng đắn, idempotent, và khả năng kiểm toán.

Khác với frontend (nơi vấn đề là hiển thị và trải nghiệm), backend có ba đặc thù nghiệp vụ riêng:

- **Nguồn sự thật duy nhất (single source of truth):** mọi trạng thái tiến độ, XP, streak, năng lực đều do backend quyết định. Frontend chỉ hiển thị và gửi tín hiệu.
- **Chống gian lận và chống nhiễu tín hiệu:** người dùng có thể farm XP, nhấn bừa “quá dễ”, gửi request trùng, hoặc sửa client. Backend phải là nơi phòng thủ cuối cùng.
- **Khả năng kiểm toán và giải thích:** mỗi quyết định adaptive và mỗi phần thưởng gamification phải truy vết được nguồn, để CSKH trả lời “tại sao tôi mất streak”, “tại sao tôi không được XP”, và để data team đánh giá mô hình.

**Nguyên tắc phân tích:**

1. Backend sở hữu trạng thái nghiệp vụ gốc; frontend không được là nguồn xác thực cho bất kỳ phần thưởng hay tiến độ nào.
2. Mọi API ghi (nộp bài, nhận thưởng, hủy subscription) phải idempotent với khóa do client cung cấp hoặc do backend cấp.
3. Adaptive và gamification phải được tách thành hai service/quy tắc độc lập nhưng có hợp đồng dữ liệu rõ ràng, để thay đổi một bên không phá bên kia.
4. Mọi quyết định phải có log bất biến (immutable log) để tái hiện khi có tranh chấp.

---

## 2. Kiến trúc nghiệp vụ backend và ranh giới trách nhiệm

| Thành phần | Trách nhiệm nghiệp vụ | Không làm |
|---|---|---|
| Learning Service | Quản lý tiến độ bài học, trạng thái hoàn thành, mở khóa unit, lưu nháp | Không tính XP, không tính độ khó adaptive |
| Assessment Service | Chấm bài, lưu attempt, cung cấp kết quả theo kỹ năng | Không quyết định phần thưởng |
| Adaptive Engine | Ước lượng năng lực người học theo chiều kỹ năng, quyết định độ khó câu/phiên bản nội dung tiếp theo | Không sinh nội dung, không thưởng XP |
| Gamification Service | Tính XP, streak, huy hiệu, nhiệm vụ, bảng xếp hạng theo quy tắc cấu hình | Không quyết định độ khó |
| Payment/Subscription Service | Quản lý đơn, trạng thái thanh toán, chu kỳ subscription, quyền truy cập | Không tính phần thưởng học tập (trừ phần thưởng mua hàng được định nghĩa riêng) |
| User/Identity Service | Tài khoản, liên kết social, phân quyền, múi giờ người dùng | Không lưu tiến độ học |
| Audit/Event Log | Ghi bất biến mọi sự kiện có ảnh hưởng đến tiến độ, XP, streak, quyết định adaptive | Không thay đổi trạng thái nghiệp vụ |

**Quyết định kiến trúc cần chốt:** Adaptive Engine và Gamification Service nên là hai service riêng hay hai module trong cùng service? Khuyến nghị hai module trong cùng service nghiệp vụ học tập ở giai đoạn MVP (giảm độ phức tạp vận hành), nhưng hợp đồng dữ liệu phải tách để có thể tách service sau này mà không phá vỡ.

---

## 3. Luồng nghiệp vụ backend cốt lõi

### 3.1 Luồng nộp bài và ghi nhận kết quả (Assessment)

**Kịch bản:** Người dùng hoàn thành một hoạt động (câu hỏi, bài tập, bài kiểm tra).

**Luồng backend:**

1. Frontend gọi API nộp bài với `attempt_id` (do backend cấp khi bắt đầu hoạt động), `item_id`, câu trả lời, `client_timestamp`, `response_time`.
2. Assessment Service kiểm tra idempotent theo `attempt_id`: nếu đã có kết quả, trả kết quả cũ, không chấm lại.
3. Chấm bài, lưu kết quả vào bảng `attempt_result` (bất biến, không update).
4. Phát sự kiện `activity_completed` vào event bus với payload đầy đủ (`user_id`, `item_id`, `correct`, `response_time`, `hint_used`, `skill_tags`, `difficulty_at_time`).
5. Learning Service cập nhật tiến độ; Adaptive Engine cập nhật mô hình năng lực; Gamification Service tính phần thưởng.
6. Trả về frontend: kết quả chấm, phần thưởng đã cộng (hoặc đang chờ), và gợi ý tiếp theo (nếu có).

**Quyết định nghiệp vụ quan trọng:**

- Chấm bài ở backend, không ở frontend. Frontend có thể hiển thị đúng/sai tức thời cho trải nghiệm, nhưng kết quả chính thức phải từ backend. Với câu hỏi mở (viết luận, nói), cần định nghĩa rõ: chấm tự động, chấm bởi AI, hay chấm bởi giáo viên — mỗi loại có SLA và trạng thái riêng.
- `response_time` phải được validate: nếu `response_time` < ngưỡng tối thiểu hợp lý (ví dụ 0.5 giây cho câu đọc hiểu), đánh dấu là tín hiệu nghi ngờ, không dùng cho adaptive, nhưng vẫn ghi nhận.
- Câu trả lời đúng nhưng dùng hint: phải ghi `hint_used` vì nó ảnh hưởng đến cả việc tính XP (không thưởng full XP) và việc ước lượng năng lực (đúng có hint không chứng minh năng lực).

### 3.2 Luồng Adaptive Engine

**Kịch bản:** Sau mỗi N hoạt động (hoặc sau mỗi hoạt động với câu hỏi quan trọng), engine cập nhật năng lực và quyết định nội dung tiếp theo.

**Luồng backend:**

1. Nhận sự kiện `activity_completed` (hoặc theo batch mỗi N sự kiện).
2. Cập nhật ước lượng năng lực theo chiều kỹ năng (theta + confidence) bằng mô hình đã cấu hình (ELO/IRT/rule-based).
3. Áp dụng quy tắc điều chỉnh độ khó (R-AL-01 đến R-AL-08 ở tài liệu trước), có giới hạn biên độ 1 cấp/lần.
4. Chọn nội dung tiếp theo từ pool, kiểm tra tính khả dụng của nội dung (pool có đủ item ở độ khó mục tiêu không).
5. Ghi decision log bất biến: input snapshot (theta trước, confidence, sự kiện gần nhất), quy tắc áp dụng, output (độ khó mới, `item_id` tiếp theo, lý do).
6. Trả quyết định cho frontend qua API (hoặc qua kênh đẩy nếu real-time).

**Quyết định nghiệp vụ quan trọng:**

- Adaptive Engine không được gọi đồng bộ trong request nộp bài nếu độ trễ tính toán cao. Khuyến nghị: nộp bài trả kết quả chấm ngay, quyết định adaptive được tính bất đồng bộ và frontend poll/push. Nếu cần real-time (ví dụ câu tiếp theo ngay lập tức), phải đặt SLA rõ (P99 < 200ms) và có phương án dự phòng: nếu engine không kịp, trả câu theo độ khó hiện tại đã lưu.
- Pool nội dung phải được kiểm tra trước khi engine chọn: nếu không đủ item ở độ khó mục tiêu, áp dụng R-AL-06 (mở rộng sang độ khó liền kề) và ghi log lý do hạ cấp.
- Không cho phép engine tự thay đổi nhãn độ khó của nội dung. Nhãn độ khó do nội dung/đào tạo gán; engine chỉ chọn trong pool đã gán nhãn.

### 3.3 Luồng Gamification Service

**Kịch bản:** Sau khi hoạt động hoàn thành, tính XP, cập nhật streak, kiểm tra huy hiệu, cập nhật nhiệm vụ.

**Luồng backend:**

1. Nhận sự kiện `activity_completed` (cùng event bus với adaptive, nhưng consumer độc lập).
2. Tính XP theo quy tắc cấu hình: XP cơ bản theo loại hoạt động + hệ số theo độ khó (do adaptive quyết định) − hệ số nếu dùng hint − hệ số nếu trả lời quá nhanh (nghi ngờ đoán mò).
3. Cập nhật streak theo múi giờ người dùng đã lưu trong User Service; kiểm tra streak freeze; kiểm tra điều kiện “hoạt động hợp lệ để tính streak” (ví dụ hoàn thành ít nhất 1 hoạt động có chấm điểm).
4. Kiểm tra điều kiện huy hiệu (theo quy tắc cấu hình), cấp huy hiệu nếu đủ điều kiện, ghi log nguồn.
5. Cập nhật tiến độ nhiệm vụ (daily/weekly), kiểm tra hoàn thành, cấp thưởng.
6. Ghi reward ledger bất biến: mỗi phần thưởng là một bút toán có nguồn, số lượng, thời điểm, trạng thái (pending/confirmed/rolled_back).
7. Phát sự kiện `reward_granted` để frontend cập nhật (qua push hoặc frontend poll).

**Quyết định nghiệp vụ quan trọng:**

- **XP theo độ khó, không theo số câu** (đã nêu ở tài liệu frontend). Backend phải nhận `difficulty_at_time` từ Adaptive Engine hoặc từ Learning Service, không tự suy ra.
- **Chống farm XP:** giới hạn XP/ngày, giới hạn XP cho cùng một item (không cộng lại lần thứ 2), phát hiện pattern bất thường (trả lời quá nhanh, tỷ lệ đúng bất thường so với mô hình năng lực). Khi phát hiện, không rollback ngay mà đánh dấu suspicious và chuyển cho review.
- **Streak phải idempotent theo ngày:** cùng một ngày, dù có nhiều hoạt động, streak chỉ tăng 1. Cần khóa theo `(user_id, date_in_user_timezone)`.
- **Reward ledger là nguồn sự thật duy nhất** cho số dư XP/coin. Không có cột “balance” được update trực tiếp; balance là tổng hợp từ ledger (hoặc materialized view có thể rebuild).

### 3.4 Luồng nhiệm vụ thích ứng độ khó

**Kịch bản:** Hệ thống tạo daily quest phù hợp trình độ người dùng.

**Luồng backend:**

1. Đầu ngày (theo múi giờ người dùng), job tạo nhiệm vụ dựa trên mô hình năng lực hiện tại: số hoạt động mục tiêu, độ khó mục tiêu, loại kỹ năng cần luyện (dựa trên điểm yếu).
2. Lưu nhiệm vụ với snapshot quy tắc (để có thể giải thích “tại sao nhiệm vụ này”).
3. Khi người dùng hoàn thành hoạt động, cập nhật tiến độ nhiệm vụ, kiểm tra hoàn thành.
4. Cấp thưởng qua reward ledger.

**Quyết định nghiệp vụ quan trọng:**

- Không tạo nhiệm vụ vượt quá năng lực: nhiệm vụ phải nằm trong vùng ZPD, không phải “hoàn thành 10 bài khó” với người mới.
- Nhiệm vụ không được khuyến khích hành vi phá adaptive: không có nhiệm vụ “trả lời 50 câu trong 5 phút”, không có nhiệm vụ “đạt combo 20 câu đúng liên tiếp” (khuyến khích đoán mò).
- Nhiệm vụ phải có thể hủy/đổi nếu người dùng thấy quá khó — cần API và quy tắc rõ.

### 3.5 Luồng thanh toán và subscription (backend)

**Nguyên tắc:** backend là nơi xác nhận thanh toán, không phải frontend.

**Luồng backend:**

1. Tạo đơn với `biz_order_no` idempotent; lưu trạng thái PENDING.
2. Gọi cổng thanh toán, nhận callback/IPN từ cổng, xác thực chữ ký, cập nhật trạng thái đơn.
3. Khi SUCCESS, kích hoạt quyền truy cập (entitlement) cho user, ghi ledger entitlement.
4. Với subscription: lưu `subscription_id`, `next_billing_date`, `status`; job định kỳ gọi cổng trừ tiền; cập nhật trạng thái; xử lý thất bại theo chính sách (retry, grace period, downgrade).
5. Phát sự kiện `entitlement_granted` để các service khác (learning, gamification) biết user đã có quyền truy cập premium.

**Quyết định nghiệp vụ quan trọng:**

- **Entitlement là nguồn sự thật cho quyền truy cập**, không phải trạng thái đơn hàng. Một user có thể có nhiều entitlement (mua lẻ, subscription, quà tặng) với thời hạn khác nhau; backend phải tính quyền truy cập hiệu lực = hợp của các entitlement còn hạn.
- **Subscription thất bại không được cắt quyền truy cập ngay:** cần grace period (ví dụ 3 ngày) và thông báo; trong grace period, user vẫn học được nhưng bị nhắc gia hạn.
- **Hoàn tiền phải cập nhật entitlement:** nếu hoàn tiền toàn phần, thu hồi entitlement tương ứng; nếu hoàn một phần, định nghĩa rõ có thu hồi hay không (thường không, nhưng phải chốt).
- Phần thưởng mua hàng (nếu có) phải được cấp sau khi xác nhận thanh toán, không cấp lạc quan.

### 3.6 Luồng hợp nhất tài khoản (khi liên kết social/OTP)

**Kịch bản:** Người dùng đăng nhập social, hệ thống phát hiện email/SĐT đã tồn tại.

**Luồng backend:**

1. Phát hiện trùng, trả về thông tin tài khoản hiện có (đã ẩn danh hóa) để frontend hiển thị.
2. Người dùng xác nhận liên kết; backend tạo liên kết identity mới vào tài khoản chính.
3. Hợp nhất dữ liệu: tiến độ học, XP, streak, huy hiệu, entitlement. Đây là phần phức tạp nhất.
4. Ghi log hợp nhất bất biến (trước/sau) để có thể hoàn tác nếu cần.

**Quyết định nghiệp vụ quan trọng (cần chốt):**

- **Quy tắc hợp nhất streak:** lấy max, lấy theo tài khoản chính, hay reset? Khuyến nghị lấy max để không phạt người dùng.
- **Quy tắc hợp nhất XP:** cộng dồn hay lấy max? Khuyến nghị cộng dồn nhưng có giới hạn chống lạm dụng (ví dụ chỉ hợp nhất tài khoản có lịch sử hoạt động thực).
- **Quy tắc hợp nhất entitlement:** hợp (union) các entitlement còn hạn; nếu trùng loại, lấy thời hạn dài hơn.
- **Quy tắc hợp nhất tiến độ học:** nếu hai tài khoản cùng học một khóa, lấy tiến độ cao hơn cho từng hoạt động; không mất dữ liệu.
- Hợp nhất phải có thể hoàn tác trong 30 ngày (trường hợp người dùng liên kết nhầm).

---

## 4. Mô hình dữ liệu nghiệp vụ cốt lõi (mức khái niệm)

| Thực thể | Mô tả | Ghi chú nghiệp vụ |
|---|---|---|
| `user` | Tài khoản, múi giờ, trạng thái | Múi giờ là thuộc tính nghiệp vụ quan trọng, ảnh hưởng streak |
| `identity` | Liên kết social/OTP | Một user có nhiều identity |
| `course`, `unit`, `activity`, `item` | Nội dung học, có nhãn độ khó và `skill_tags` | Nhãn do nội dung gán, không do engine |
| `attempt` | Một lần làm bài, có `attempt_id` idempotent | Bất biến sau khi chấm |
| `attempt_result` | Kết quả chấm, có `correct`, `response_time`, `hint_used` | Bất biến |
| `learner_model` | Ước lượng năng lực theo chiều, có `theta`, `confidence`, `updated_at` | Cập nhật theo sự kiện, có snapshot lịch sử |
| `adaptive_decision_log` | Log quyết định độ khó, có input snapshot, `rule_id`, output | Bất biến, giữ theo chính sách lưu trữ |
| `reward_ledger` | Bút toán XP/coin/huy hiệu, có nguồn, số lượng, trạng thái | Bất biến, balance là tổng hợp |
| `streak_state` | Trạng thái streak theo user, có `last_active_date`, `freeze_count` | Khóa theo `(user_id, date)` |
| `quest` | Nhiệm vụ được tạo, có snapshot quy tắc và tiến độ | Có thể hủy/đổi |
| `order` | Đơn thanh toán, có `biz_order_no` idempotent | Trạng thái theo cổng |
| `subscription` | Chu kỳ, `next_billing_date`, `status` | Có grace period |
| `entitlement` | Quyền truy cập, có `type`, `start_date`, `end_date` | Nguồn sự thật cho quyền truy cập |
| `merge_log` | Log hợp nhất tài khoản, có trước/sau | Có thể hoàn tác trong 30 ngày |

**Quyết định nghiệp vụ quan trọng:** `reward_ledger` và `adaptive_decision_log` phải là append-only. Không có UPDATE/DELETE; mọi sửa sai phải là bút toán đảo (reversal entry) có lý do. Đây là yêu cầu kiểm toán, không phải yêu cầu kỹ thuật.

---

## 5. Quy tắc nghiệp vụ backend (điều kiện → hành động)

| Mã | Quy tắc | Điều kiện | Hành động |
|---|---|---|---|
| R-BE-01 | Idempotent nộp bài | Cùng `attempt_id` gửi lại | Trả kết quả cũ, không chấm lại, không cộng XP lần 2 |
| R-BE-02 | Tín hiệu nghi ngờ | `response_time` < ngưỡng tối thiểu cho loại câu | Ghi nhận, đánh dấu suspicious, không dùng cho adaptive, không cộng full XP |
| R-BE-03 | XP theo độ khó | Hoạt động hoàn thành | XP = base × hệ số độ khó − hệ số hint − hệ số nghi ngờ |
| R-BE-04 | Chống farm XP | Cùng `item_id` đã được cộng XP trong 24h | Không cộng XP lần nữa, vẫn cập nhật adaptive |
| R-BE-05 | Streak idempotent theo ngày | Đã có streak cho `(user_id, date)` hôm nay | Không tăng thêm, ghi nhận hoạt động |
| R-BE-06 | Streak bảo vệ khi mất mạng | Hoạt động hoàn thành local và đồng bộ trong 24h | Vẫn tính streak cho ngày hoạt động |
| R-BE-07 | Adaptive không kịp | Engine timeout khi chọn câu tiếp theo | Trả câu theo độ khó đã lưu gần nhất, ghi log fallback |
| R-BE-08 | Pool nội dung thiếu | Số item ở độ khó mục tiêu < 3 | Mở rộng sang độ khó liền kề, ghi log lý do |
| R-BE-09 | Subscription thất bại | Cổng trả thất bại | Retry theo chính sách, giữ entitlement trong grace period, thông báo |
| R-BE-10 | Hoàn tiền toàn phần | Hoàn tiền = số tiền đơn | Thu hồi entitlement tương ứng, ghi log |
| R-BE-11 | Hợp nhất tài khoản | Liên kết identity mới vào tài khoản chính | Hợp nhất theo quy tắc đã chốt, ghi `merge_log`, có thể hoàn tác 30 ngày |
| R-BE-12 | Phần thưởng mua hàng | Đơn SUCCESS | Cấp phần thưởng qua reward ledger với nguồn purchase |
| R-BE-13 | Sửa sai phần thưởng | Phát hiện cấp sai | Bút toán đảo có lý do, không xóa bút toán gốc |
| R-BE-14 | Nhiệm vụ không phá adaptive | Tạo quest | Kiểm tra quest không chứa điều kiện khuyến khích đoán mò |

---

## 6. Yêu cầu phi chức năng backend

| Loại | Yêu cầu |
|---|---|
| Hiệu năng | API nộp bài P99 < 300ms (không gồm chấm tự động phức tạp); API lấy câu tiếp theo P99 < 200ms; API trạng thái đơn P99 < 150ms |
| Tính nhất quán | Reward ledger append-only; balance có thể rebuild từ ledger; entitlement là nguồn sự thật cho quyền truy cập |
| Idempotent | Mọi API ghi có khóa idempotent do client cung cấp hoặc backend cấp; retry an toàn |
| Khả năng kiểm toán | `adaptive_decision_log` và `reward_ledger` giữ tối thiểu 12 tháng; có API tra cứu cho CSKH theo `user_id` và khoảng thời gian |
| Khả năng hạ cấp | Adaptive Engine timeout → fallback theo độ khó đã lưu; Gamification Service lỗi → không chặn học, phần thưởng chờ xử lý và cấp bù |
| Bảo mật | Không lưu số thẻ/CVV; token cổng thanh toán lưu mã hóa; log che SĐT/email; rate limit API nhận thưởng và API “quá dễ/quá khó” |
| Chống gian lận | Phát hiện pattern bất thường (tốc độ, tỷ lệ đúng so với mô hình), đánh dấu suspicious, chuyển review, không rollback tự động |
| Đa múi giờ | Mọi tính toán streak/quest theo múi giờ người dùng đã lưu; job chạy theo múi giờ địa phương hoặc quét định kỳ |
| Khả năng quan sát | Mỗi sự kiện có `trace_id` xuyên service; dashboard theo dõi tỷ lệ fallback adaptive, tỷ lệ reward pending, tỷ lệ suspicious |

---

## 7. Các quyết định nghiệp vụ cần chốt (danh sách cần xác nhận)

1. **Adaptive Engine đồng bộ hay bất đồng bộ trong luồng nộp bài:** ảnh hưởng trực tiếp đến SLA và trải nghiệm “câu tiếp theo ngay lập tức”. Khuyến nghị bất đồng bộ với fallback, nhưng cần Product xác nhận trải nghiệm chấp nhận được.
2. **Ngưỡng `response_time` tối thiểu cho từng loại câu:** cần data team và nội dung cùng chốt, không thể để kỹ sư tự đặt.
3. **Quy tắc hợp nhất tài khoản:** streak lấy max hay theo tài khoản chính; XP cộng dồn hay max; entitlement hợp hay chọn. Đây là quyết định nghiệp vụ có ảnh hưởng pháp lý (quyền truy cập đã mua) và tâm lý (streak).
4. **Chính sách grace period cho subscription:** bao nhiêu ngày, có thông báo mấy lần, có giảm quyền truy cập dần không.
5. **Chính sách hoàn tiền và thu hồi entitlement:** hoàn một phần có thu hồi không; hoàn toàn phần có thu hồi ngay hay đến hết kỳ.
6. **Chính sách lưu trữ log:** `adaptive_decision_log` và `reward_ledger` giữ bao lâu; có yêu cầu xóa theo yêu cầu người dùng (GDPR/PDPA) không, và xóa như thế nào để vẫn giữ khả năng kiểm toán.
7. **Múi giờ và streak:** chốt múi giờ người dùng, cách xử lý người dùng đổi múi giờ (du lịch), và cách hiển thị cho người dùng.
8. **Chống gian lận ở mức nào:** chỉ đánh dấu và review thủ công, hay có biện pháp tự động (giới hạn XP/ngày, tạm khóa tính năng). Cần chốt với Risk.
9. **Tách service Adaptive và Gamification:** giữ chung service ở MVP hay tách ngay từ đầu. Ảnh hưởng đến chi phí vận hành và tốc độ phát triển.
10. **Quyền riêng tư dữ liệu học tập:** dữ liệu năng lực và hành vi học tập là dữ liệu cá nhân nhạy cảm; cần chốt chính sách lưu trữ, truy cập, và xóa theo quy định Việt Nam (Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).

---

## 8. Rủi ro nghiệp vụ điển hình nếu backend làm thiếu

| Rủi ro | Hậu quả | Biện pháp nghiệp vụ |
|---|---|---|
| Chấm bài ở frontend | Người dùng sửa client để gian lận, mô hình năng lực sai | Chấm ở backend, frontend chỉ hiển thị tạm |
| Không idempotent nộp bài | Cộng XP trùng, tiến độ sai, tranh chấp | `attempt_id` idempotent, trả kết quả cũ |
| Adaptive chạy đồng bộ không fallback | Nộp bài bị treo khi engine lỗi | Fallback theo độ khó đã lưu, ghi log |
| Reward ledger có UPDATE | Không thể kiểm toán, không thể rebuild balance | Append-only, bút toán đảo cho sửa sai |
| Streak không khóa theo ngày | Tăng nhiều lần trong một ngày | Khóa `(user_id, date)`, idempotent |
| Hợp nhất tài khoản không có log | Không thể hoàn tác khi liên kết nhầm | `merge_log` bất biến, hoàn tác trong 30 ngày |
| Subscription thất bại cắt quyền ngay | Người dùng mất quyền truy cập oan | Grace period + thông báo |
| Hoàn tiền không thu hồi entitlement | Người dùng giữ quyền truy cập sau khi hoàn tiền | Thu hồi entitlement theo quy tắc, ghi log |
| Nhiệm vụ khuyến khích đoán mò | Mô hình năng lực nhiễu, adaptive sai | Quy tắc tạo quest không chứa điều kiện phá adaptive |
| Log adaptive không đủ chi tiết | CSKH không trả lời được “tại sao tôi bị giảm độ khó” | Decision log có input snapshot, `rule_id`, output |

---

## 9. Đề xuất cấu trúc tài liệu backend cho đội phát triển

Nên tách tài liệu backend thành năm lớp:

1. **Sơ đồ service và hợp đồng dữ liệu:** mỗi service, event nào phát, event nào nhận, payload tối thiểu.
2. **Đặc tả API theo sự kiện:** bảng “API nào → idempotent bằng gì → validate gì → ghi gì → phát event gì → trả gì → lỗi nào”. Đây là phần kỹ sư backend đọc nhiều nhất.
3. **Sơ đồ trạng thái nghiệp vụ:** attempt, order, subscription, entitlement, streak, quest — mỗi thực thể có state machine rõ ràng với transition và điều kiện.
4. **Ma trận quy tắc Adaptive × Gamification:** bảng quy tắc backend (mục 5), mở rộng theo từng loại hoạt động.
5. **Chính sách lưu trữ, kiểm toán và quyền riêng tư:** thời gian lưu log, quyền truy cập, quy trình xóa theo yêu cầu người dùng, và cách đảm bảo khả năng kiểm toán sau khi xóa.

---

## Kết luận

Với website học ngoại ngữ kết hợp adaptive và gamification, giá trị lớn nhất của phân tích backend không nằm ở việc liệt kê API, mà ở việc chốt trước các quyết định nghiệp vụ có ảnh hưởng đến tín hiệu, tài sản tâm lý và quyền truy cập — “XP theo độ khó hay số câu”, “streak lấy max hay theo tài khoản chính”, “hoàn tiền có thu hồi entitlement không”, “log giữ bao lâu và xóa thế nào”.

Nếu các quyết định này không được chốt ở giai đoạn phân tích nghiệp vụ, chúng sẽ được chốt ngẫu nhiên bởi lập trình viên backend, và hậu quả không chỉ là bug — mà là mô hình adaptive bị nhiễu vĩnh viễn.
