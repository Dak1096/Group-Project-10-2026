# Bổ sung: Đặc tả Swagger/OpenAPI cho Backend API

## 1. Định vị và nguyên tắc

Swagger (OpenAPI) không phải là “tài liệu cho vui” hay “công cụ để test API”. OpenAPI specification là hợp đồng nghiệp vụ có thể thực thi giữa frontend, backend, QA và đối tác tích hợp. Nó là nguồn sự thật duy nhất cho:

- **Hình dạng dữ liệu:** frontend biết chính xác field nào có, kiểu gì, bắt buộc hay không.
- **Ngữ nghĩa lỗi:** mỗi mã lỗi trả về tương ứng với tình huống nghiệp vụ nào, frontend xử lý ra sao.
- **Ràng buộc bảo mật:** endpoint nào yêu cầu JWT, endpoint nào yêu cầu re-auth, endpoint nào idempotent.

**Nguyên tắc thiết kế:**

1. OpenAPI phải được sinh từ code hoặc được validate trong CI, không phải viết tay rồi để lệch với thực tế. Nếu spec lệch code, nó trở thành tài liệu nói dối — tệ hơn không có.
2. Mỗi endpoint phải có ví dụ request/response thực tế cho các trường hợp thành công và lỗi nghiệp vụ. Ví dụ là cách duy nhất để QA và frontend hiểu đúng mà không cần đọc code.
3. Mã lỗi phải có ngữ nghĩa nghiệp vụ, không chỉ 400/500 chung chung. Frontend cần phân biệt “token hết hạn” (`401 TOKEN_EXPIRED`) với “token bị thu hồi” (`401 SESSION_REVOKED`) để xử lý khác nhau.
4. Bảo mật phải được khai báo ở cấp spec, không phải ghi chú trong mô tả. Nếu endpoint thanh toán yêu cầu re-auth, spec phải thể hiện điều đó qua security scheme.

---

## 2. Cấu trúc OpenAPI cho dự án học ngoại ngữ

### 2.1 Thông tin chung (`info`, `servers`, `tags`)

| Thành phần | Nội dung nghiệp vụ | Ghi chú |
|---|---|---|
| `info.title` | “Language Learning API” | — |
| `info.version` | Theo semantic versioning, tăng khi có breaking change | Phải có changelog riêng |
| `info.description` | Mô tả ngắn gọn phạm vi: auth, learning, adaptive, gamification, payment | Không copy toàn bộ BRD vào đây |
| `servers` | dev, staging, production với URL riêng | Không hard-code production URL trong client |
| `tags` | Auth, Learning, Adaptive, Gamification, Payment, Account | Mỗi tag ánh xạ một nhóm endpoint theo service nghiệp vụ |

### 2.2 Security Schemes

Đây là phần quan trọng nhất cần chốt, vì nó thể hiện quyết định nghiệp vụ về JWT:

| Scheme | Kiểu | Áp dụng cho | Ngữ nghĩa nghiệp vụ |
|---|---|---|---|
| `BearerAuth` | HTTP Bearer (JWT) | Hầu hết endpoint | Access token hợp lệ, chưa hết hạn |
| `RefreshCookie` | API Key trong cookie | Chỉ `/auth/refresh` | Refresh token trong HttpOnly cookie |
| `ReAuthRequired` | (mô tả qua header `X-ReAuth-Token`) | `/payment/*`, `/account/change-password`, `/account/change-email` | Yêu cầu `authTime` gần (dưới 5 phút); nếu không, trả `403 REAUTH_REQUIRED` |

**Quyết định nghiệp vụ:** endpoint nào thuộc nhóm `ReAuthRequired` phải được liệt kê rõ trong spec. Nếu không chốt, backend sẽ bỏ qua kiểm tra re-auth và frontend không biết cần hiển thị màn hình xác thực lại.

### 2.3 Cấu trúc lỗi thống nhất

Mọi response lỗi phải theo cùng một schema, để frontend xử lý nhất quán:

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token đã hết hạn",
    "traceId": "uuid",
    "details": { }
  }
}
```

Bảng mã lỗi nghiệp vụ cần định nghĩa trong spec (dùng `components.schemas.ErrorCode` với enum):

| Nhóm | Mã lỗi | HTTP | Ngữ nghĩa nghiệp vụ | Frontend xử lý |
|---|---|---|---|---|
| Auth | `INVALID_CREDENTIALS` | 401 | Sai email/mật khẩu | Hiển thị lỗi form |
| Auth | `TOKEN_EXPIRED` | 401 | Access token hết hạn | Gọi `/auth/refresh` rồi retry |
| Auth | `SESSION_REVOKED` | 401 | Phiên bị thu hồi (logout-all, phát hiện reuse) | Xóa token, về trang đăng nhập |
| Auth | `REAUTH_REQUIRED` | 403 | Cần xác thực lại cho hành động nhạy cảm | Hiển thị modal nhập mật khẩu/OTP |
| Auth | `ACCOUNT_LOCKED` | 403 | Tài khoản bị khóa | Hiển thị thông báo liên hệ CSKH |
| Learning | `ATTEMPT_ALREADY_SUBMITTED` | 409 | Nộp bài trùng `attempt_id` | Hiển thị kết quả đã có (idempotent) |
| Learning | `CONTENT_LOCKED` | 403 | Chưa mua/gói hết hạn | Hiển thị CTA mua/gia hạn |
| Adaptive | `ADAPTIVE_FALLBACK` | 200 | (Không phải lỗi) Quyết định theo độ khó đã lưu | Hiển thị câu, không hiển thị lý do gợi ý |
| Gamification | `REWARD_PENDING` | 202 | Phần thưởng đang xử lý | Hiển thị animation chờ, poll trạng thái |
| Gamification | `REWARD_SUSPICIOUS` | 200 | Phần thưởng bị đánh dấu nghi ngờ | Hiển thị XP nhưng có thể bị review |
| Payment | `DUPLICATE_ORDER` | 409 | Đơn đã tồn tại | Hiển thị trạng thái đơn hiện có |
| Payment | `PAYMENT_PENDING` | 202 | Đang chờ xác nhận từ cổng | Poll trạng thái đơn |
| Payment | `REFUND_EXCEED` | 400 | Hoàn tiền vượt số tiền gốc | Hiển thị lỗi, không cho gửi lại |

**Quyết định:** mã lỗi phải ổn định theo thời gian. Nếu đổi tên mã, phải giữ alias trong ít nhất một chu kỳ release để frontend cũ không bị vỡ.

---

## 3. Đặc tả endpoint theo nhóm nghiệp vụ

### 3.1 Nhóm Auth

| Endpoint | Method | Security | Idempotent | Mô tả nghiệp vụ |
|---|---|---|---|---|
| `/auth/login` | POST | — | Không | Đăng nhập, trả access token + set refresh cookie |
| `/auth/refresh` | POST | `RefreshCookie` | Có (theo refresh token) | Rotation; phát hiện reuse → thu hồi toàn bộ |
| `/auth/logout` | POST | `BearerAuth` | Có | Thu hồi refresh token thiết bị hiện tại |
| `/auth/logout-all` | POST | `BearerAuth` + `ReAuthRequired` | Có | Thu hồi tất cả refresh token |
| `/auth/reauth` | POST | `BearerAuth` | Không | Xác thực lại, trả `X-ReAuth-Token` ngắn hạn |

**Yêu cầu spec:**

- `/auth/login` phải có ví dụ response thành công (access token + `Set-Cookie`) và ví dụ lỗi `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`.
- `/auth/refresh` phải mô tả rõ hành vi khi refresh token đã `ROTATED`: trả `401 SESSION_REVOKED`, không trả token mới.
- `/auth/reauth` phải mô tả thời hạn của `X-ReAuth-Token` (ví dụ 5 phút) và header nào cần gửi kèm ở endpoint nhạy cảm.

### 3.2 Nhóm Learning

| Endpoint | Method | Security | Idempotent | Mô tả nghiệp vụ |
|---|---|---|---|---|
| `/learning/courses` | GET | `BearerAuth` | — | Danh sách khóa học, kèm trạng thái sở hữu |
| `/learning/courses/{id}/units` | GET | `BearerAuth` | — | Unit trong khóa, kèm trạng thái mở khóa |
| `/learning/activities/{id}/start` | POST | `BearerAuth` | Có | Bắt đầu hoạt động, trả `attempt_id` |
| `/learning/attempts/{attemptId}/submit` | POST | `BearerAuth` | Có (theo `attempt_id`) | Nộp bài, trả kết quả + phần thưởng |
| `/learning/progress` | GET | `BearerAuth` | — | Tiến độ theo unit/kỹ năng |

**Yêu cầu spec:**

- `/learning/attempts/{attemptId}/submit` phải có ví dụ response khi `attempt_id` đã được nộp: trả `200` với kết quả cũ (idempotent), không trả `409` — vì đây là hành vi retry hợp lệ.
- Response của submit phải bao gồm `reward` với trạng thái `PENDING`/`CONFIRMED`, để frontend biết có cần poll hay không.

### 3.3 Nhóm Adaptive

| Endpoint | Method | Security | Idempotent | Mô tả nghiệp vụ |
|---|---|---|---|---|
| `/adaptive/next-item` | GET | `BearerAuth` | — | Lấy câu/hoạt động tiếp theo theo quyết định adaptive |
| `/adaptive/override` | POST | `BearerAuth` | Có (theo `override_id`) | Người dùng nhấn “quá dễ/quá khó” |
| `/adaptive/decision-log/{attemptId}` | GET | `BearerAuth` | — | (Nội bộ/CSKH) Xem lý do quyết định |

**Yêu cầu spec:**

- `/adaptive/next-item` phải mô tả rõ: nếu engine timeout, trả `200` với `fallback: true` và item theo độ khó đã lưu, không trả lỗi — vì đây là hành vi hạ cấp đã chốt.
- `/adaptive/override` phải có rate limit được mô tả trong spec (ví dụ header `X-RateLimit-Remaining`), và trả `429 OVERRIDE_RATE_LIMITED` khi vượt.

### 3.4 Nhóm Gamification

| Endpoint | Method | Security | Idempotent | Mô tả nghiệp vụ |
|---|---|---|---|---|
| `/gamification/profile` | GET | `BearerAuth` | — | XP, streak, huy hiệu hiện tại |
| `/gamification/rewards/{rewardId}` | GET | `BearerAuth` | — | Trạng thái phần thưởng (poll khi `PENDING`) |
| `/gamification/quests/today` | GET | `BearerAuth` | — | Nhiệm vụ hôm nay (đã cá nhân hóa) |
| `/gamification/leaderboard` | GET | `BearerAuth` | — | Bảng xếp hạng theo nhóm trình độ |

**Yêu cầu spec:**

- `/gamification/rewards/{rewardId}` phải có ví dụ `PENDING`, `CONFIRMED`, `SUSPICIOUS`, `ROLLED_BACK`.
- `/gamification/leaderboard` phải mô tả rõ phạm vi (theo nhóm trình độ, không toàn hệ thống) — đây là quyết định nghiệp vụ đã chốt ở tài liệu frontend.

### 3.5 Nhóm Payment

| Endpoint | Method | Security | Idempotent | Mô tả nghiệp vụ |
|---|---|---|---|---|
| `/payment/orders` | POST | `BearerAuth` + `ReAuthRequired` | Có (theo `biz_order_no`) | Tạo đơn thanh toán |
| `/payment/orders/{orderNo}/status` | GET | `BearerAuth` | — | Poll trạng thái đơn |
| `/payment/orders/{orderNo}/refund` | POST | `BearerAuth` + `ReAuthRequired` | Có (theo `refund_id`) | Yêu cầu hoàn tiền (nội bộ/CSKH) |
| `/payment/callback/{provider}` | POST | (Xác thực chữ ký provider) | Có | Nhận IPN từ cổng thanh toán |

**Yêu cầu spec:**

- `/payment/orders` phải có ví dụ `403 REAUTH_REQUIRED` khi `authTime` quá cũ.
- `/payment/callback/{provider}` phải được đánh dấu `security: []` (không dùng JWT) nhưng mô tả rõ cơ chế xác thực chữ ký trong `description`.
- `/payment/orders/{orderNo}/status` phải mô tả các trạng thái: `PENDING`, `SUCCESS`, `FAILED`, `EXPIRED`, `REFUNDED`.

### 3.6 Nhóm Account

| Endpoint | Method | Security | Idempotent | Mô tả nghiệp vụ |
|---|---|---|---|---|
| `/account/me` | GET | `BearerAuth` | — | Thông tin tài khoản (không trả PII nhạy cảm) |
| `/account/change-password` | POST | `BearerAuth` + `ReAuthRequired` | Không | Đổi mật khẩu, thu hồi tất cả refresh token |
| `/account/change-email` | POST | `BearerAuth` + `ReAuthRequired` | Không | Đổi email, cần xác thực OTP |
| `/account/link-identity` | POST | `BearerAuth` | Có (theo `link_id`) | Liên kết social/OTP, có thể merge tài khoản |

**Yêu cầu spec:**

- `/account/change-password` phải mô tả rõ: sau khi thành công, tất cả refresh token bị thu hồi; access token hiện tại vẫn dùng được đến khi hết hạn (hoặc trả `401` ngay nếu có blocklist).
- `/account/link-identity` phải có ví dụ response khi phát hiện trùng tài khoản: trả `409 ACCOUNT_MERGE_REQUIRED` với thông tin tài khoản hiện có (đã ẩn danh hóa) để frontend hiển thị.

---

## 4. Components: schema dùng chung

Các schema sau phải được định nghĩa một lần trong `components.schemas` và tái sử dụng:

| Schema | Dùng cho | Ràng buộc nghiệp vụ |
|---|---|---|
| `Error` | Mọi response lỗi | Bắt buộc `code`, `message`, `traceId` |
| `Pagination` | Mọi danh sách | `page`, `pageSize`, `total`; `pageSize` tối đa 100 |
| `Reward` | Gamification | `rewardId`, `type` (XP/COIN/BADGE), `amount`, `status`, `source` |
| `Attempt` | Learning | `attemptId`, `itemId`, `startedAt`, `submittedAt`, `result` |
| `AdaptiveDecision` | Adaptive | `itemId`, `difficulty`, `reason`, `fallback` |
| `Order` | Payment | `orderNo`, `amount`, `currency`, `status`, `channel` |
| `Entitlement` | Account/Payment | `type`, `startDate`, `endDate`, `source` |

**Quyết định:** `Reward.status` và `Order.status` phải dùng enum cố định trong spec, không dùng string tự do. Nếu thêm trạng thái mới, phải là thay đổi có kiểm soát (minor version) và frontend phải xử lý trạng thái không xác định bằng fallback an toàn.

---

## 5. Yêu cầu chất lượng spec

| Yêu cầu | Mô tả | Cách kiểm tra |
|---|---|---|
| Spec phải validate | Không có lỗi schema, không có `$ref` gãy | Chạy `spectral lint` hoặc `swagger-cli validate` trong CI |
| Spec phải khớp code | Response thực tế khớp schema | Contract test (Dredd, Schemathesis) chạy trong CI |
| Mọi endpoint có ví dụ | Ít nhất một ví dụ thành công và một ví dụ lỗi nghiệp vụ | Review thủ công trong PR |
| Mọi mã lỗi có trong enum | Không có mã lỗi “ma” xuất hiện trong code mà không có trong spec | Test tự động so sánh error code trong code với enum |
| Security scheme được khai báo | Không có endpoint nào thiếu security (trừ public) | Lint rule kiểm tra |
| Không có PII trong ví dụ | Ví dụ dùng email/SĐT giả, không dùng dữ liệu thật | Review thủ công |

---

## 6. Các quyết định cần chốt

| # | Quyết định | Ảnh hưởng | Khuyến nghị |
|---|---|---|---|
| 1 | Spec sinh từ code (code-first) hay viết tay (design-first)? | Độ chính xác vs tốc độ | Design-first cho endpoint mới (chốt nghiệp vụ trước), sinh từ code cho endpoint đã ổn định |
| 2 | Có dùng contract test trong CI không? | Phát hiện lệch spec-code sớm | Có, bắt buộc với endpoint payment và auth |
| 3 | Mã lỗi có phiên bản không? | Ổn định cho frontend | Có, giữ alias khi đổi tên |
| 4 | Có public spec cho đối tác tích hợp không? | Bảo mật vs tích hợp | Tách spec public (không có endpoint nội bộ) và spec nội bộ |
| 5 | Ai chịu trách nhiệm cập nhật spec khi code thay đổi? | Trách nhiệm rõ ràng | Backend owner; bên phụ trách nghiệp vụ review PR có thay đổi spec |
| 6 | Có dùng Swagger UI cho CSKH tra cứu không? | Tiện lợi vs bảo mật | Chỉ môi trường nội bộ, có xác thực; không public |

---

## 7. Rủi ro nghiệp vụ điển hình nếu Swagger làm thiếu

| Rủi ro | Hậu quả | Biện pháp |
|---|---|---|
| Spec lệch code | Frontend code theo spec cũ, gặp lỗi runtime | Contract test trong CI |
| Không có mã lỗi nghiệp vụ | Frontend chỉ hiển thị “có lỗi xảy ra” chung chung | Enum error code + ví dụ |
| Không khai báo `ReAuthRequired` | Payment API nhận token cũ, rủi ro gian lận | Security scheme + review PR |
| Ví dụ chứa PII thật | Lộ dữ liệu qua tài liệu public | Dùng dữ liệu giả, review thủ công |
| Không mô tả idempotency | Frontend retry gây trùng reward/order | Ghi rõ `Idempotency-Key` trong spec |
| Không mô tả fallback adaptive | Frontend tưởng lỗi khi nhận `fallback: true` | Ví dụ response có `fallback` |

---

## Kết luận

Với backend API của dự án học ngoại ngữ, Swagger không phải là “tài liệu cho đẹp”. Nó là hợp đồng nghiệp vụ có thể validate tự động — nơi mã lỗi, security scheme, và hành vi idempotent được chốt trước khi code.

Nếu không đầu tư vào spec, frontend sẽ tự đoán cách xử lý lỗi, QA sẽ không biết test gì, và đối tác tích hợp sẽ phải đọc code để hiểu API — tất cả đều là chi phí ẩn cao hơn nhiều so với việc viết spec đúng ngay từ đầu.
