# EnglishStep – Hệ Thống Học Ngoại Ngữ Tích Hợp JWT Hoàn Chỉnh (RFC 7519)

Dự án đã tích hợp đầy đủ hệ thống xác thực và phân quyền bằng **JSON Web Token (JWT)** bám sát 100% tài liệu nghiệp vụ `Business analysis/Jwt.md` và đặc tả OpenAPI.

---

## 1. Các Tính Năng JWT Đã Tích Hợp

| Quy tắc / Tính năng | Mô tả chi tiết | Nơi triển khai |
|---|---|---|
| **Cấu trúc chuẩn RFC 7519** | Header (`alg: RS256/HS256`, `typ: JWT`, `kid`), Payload claims (`sub`, `iss`, `aud`, `exp`, `iat`, `jti`, `roles`, `scope`, `device_id`), Signature | `src/api/jwt-crypto.js`, `server/server.mjs` |
| **BR-01 (Token TTL)** | Access Token TTL = 15 phút (900s); Refresh Token TTL = 7 ngày (604,800s) | `src/api/jwt-auth-core.js` |
| **BR-02 (Bearer Header)** | Gọi API thông qua header `Authorization: Bearer <AT>` và `X-Device-Id` | `src/api/index.js` |
| **BR-03 (Token Rotation)** | Mỗi lần `/auth/refresh` sẽ tự động vô hiệu hóa RT cũ ngay và cấp bộ AT/RT mới | `jwt-auth-core.js`, `mock.js`, `server.mjs` |
| **BR-04 (Reuse Detection)** | Phát hiện tái sử dụng RT cũ (Token Theft) → lập tức thu hồi toàn bộ phiên của user/device (Family Revocation, `401 SESSION_REVOKED`) | `jwt-auth-core.js`, `server.mjs` |
| **BR-05 (Device Binding)** | Mỗi RT gắn chặt với một `device_id`; dùng RT trên thiết bị khác bị từ chối (`401 REFRESH_TOKEN_INVALID`) | `src/api/device.js`, `jwt-auth-core.js` |
| **BR-06 (Denylist & Revocation)**| Khi logout, user bị khóa hoặc đổi pass: jti của AT đưa vào Denylist (`401 TOKEN_REVOKED`), RT bị xóa | `jwt-auth-core.js`, `mock.js` |
| **BR-07 (Thuật toán ký an toàn)**| Ký Asymmetric RS256 hoặc HMAC-SHA256, cấm `alg: none`, kiểm tra chữ ký chặt chẽ | `jwt-crypto.js`, `server.mjs` |
| **BR-08 (Bảo mật Payload)** | Payload không chứa PII, mật khẩu hay dữ liệu thẻ ngân hàng | `jwt-auth-core.js` |
| **BR-10 (Audit Trail)** | Ghi log mọi sự kiện cấp phát/thu hồi token (`LOGIN`, `REFRESH`, `REUSE_DETECTED`, `LOGOUT`), không log token thô | `jwt-auth-core.js`, `views/JwtConsoleView.vue` |
| **Client Auto-Refresh** | Interceptor bắt lỗi `401 TOKEN_EXPIRED`, tự động gọi `/auth/refresh` và retry request gốc duy nhất 1 lần | `src/api/index.js` |
| **JWT Security Console** | Bảng điều khiển trực quan hóa Header, Payload, Signature, đếm ngược TTL, chạy tự động 10/10 Test Cases | `src/views/JwtConsoleView.vue` |

---

## 2. Hướng Dẫn Khởi Chạy

### 2.1 Cài đặt & Chạy Frontend (Kèm JWT Console)

```bash
cd englishstep-frontend
npm install

# Khởi chạy frontend ở chế độ dev (mặc định dùng JWT engine tích hợp sẵn):
npm run dev
```

Truy cập: [http://localhost:5173](http://localhost:5173)  
- **Tài khoản mặc định:** `a@b.vn` / Mật khẩu: `demo1234`
- Sau khi đăng nhập, chọn menu **"🛡 Bảo mật JWT"** trên thanh điều hướng (`/jwt-console`) để mở Trung tâm kiểm thử & thanh tra token trực quan.

### 2.2 Chạy Bộ Kiểm Thử Tự Động (Test Suites)

Dự án cung cấp 2 bộ kiểm thử tự động toàn diện:

```bash
# 1. Chạy toàn bộ kiểm thử xác thực 10 Test Cases & 10 Business Rules theo Jwt.md:
npm run test:jwt

# 2. Chạy kiểm thử hợp đồng mock frontend ↔ backend (8 nhóm nghiệp vụ):
npm run test:mock

# 3. Chạy cả 2 bộ test cùng lúc:
npm test
```

### 2.3 Khởi Chạy Backend Server Độc Lập (Node.js REST API + RS256 JWKS)

```bash
# Khởi chạy Backend API Server trên cổng 3001:
npm run server
```

Server cung cấp đầy đủ các endpoint theo OpenAPI spec:
- `GET /.well-known/jwks.json` : JWKS Public Key Endpoint (RFC 7517)
- `POST /api/auth/login` : Đăng nhập & cấp phát Access Token + Refresh Token
- `POST /api/auth/refresh` : Refresh Token Rotation & Reuse Detection
- `POST /api/auth/logout` : Đăng xuất & đưa AT vào Denylist
- `POST /api/auth/logout-all` : Thu hồi toàn bộ phiên của mọi thiết bị
- `GET /api/auth/audit-logs` : Nhật ký kiểm toán an ninh thời gian thực
- `GET /api/auth/me` : Lấy thông tin người dùng từ Bearer Token
- Các API nghiệp vụ: `/api/learning/progress`, `/api/gamification/profile`

Để frontend kết nối trực tiếp đến backend server thật: đặt `VITE_USE_MOCK=false` trong file `.env`.

---

## 3. Ma Trận Đối Chiếu 10 Kịch Bản Kiểm Thử (TC-01 → TC-10)

| Mã TC | Kịch bản kiểm thử | Kết quả kỳ vọng (Jwt.md) | Trạng thái |
|:---:|---|---|:---:|
| **TC-01** | Đăng nhập đúng credentials | Nhận `access_token` (TTL ≤ 15m) + `refresh_token` (TTL ≤ 7d) hợp lệ | **PASS** |
| **TC-02** | Gọi API với Access Token hợp lệ | HTTP 200 OK, dữ liệu trả về chính xác | **PASS** |
| **TC-03** | Gọi API với Access Token hết hạn | Trả về `401 TOKEN_EXPIRED`, client tự động refresh và retry thành công | **PASS** |
| **TC-04** | Gọi API không có header Authorization | Trả về `401 UNAUTHORIZED` / `SESSION_REVOKED` | **PASS** |
| **TC-05** | Làm mới token với Refresh Token hợp lệ | Nhận bộ AT/RT mới; RT cũ bị vô hiệu hóa ngay lập tức (Rotation) | **PASS** |
| **TC-06** | Tấn công dùng lại Refresh Token cũ đã bị rotate | Trả về `401 SESSION_REVOKED`, kích hoạt **Reuse Detection**, thu hồi toàn bộ token family | **PASS** |
| **TC-07** | Dùng Refresh Token trên thiết bị khác | Trả về `401 REFRESH_TOKEN_INVALID` do sai lệch `device_id` | **PASS** |
| **TC-08** | Người dùng bị khóa tài khoản giữa phiên | Request tiếp theo bị từ chối `403 ACCOUNT_LOCKED` | **PASS** |
| **TC-09** | Token bị sửa payload (Tamper) | Trả về `401 TOKEN_INVALID` do không khớp chữ ký số | **PASS** |
| **TC-10** | Đăng xuất người dùng (Logout) | Refresh Token bị xóa, `jti` của Access Token đưa vào Denylist (`401 TOKEN_REVOKED`) | **PASS** |
