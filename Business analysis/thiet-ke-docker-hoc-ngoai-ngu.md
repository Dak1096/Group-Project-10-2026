# Tài liệu thiết kế Docker cho dự án website học ngoại ngữ (Adaptive Learning + Gamification)

## 1. Định vị và nguyên tắc

Docker trong dự án này không phải là quyết định kỹ thuật thuần túy của đội DevOps. Docker là hợp đồng vận hành giữa nghiệp vụ và hạ tầng: nó quyết định tốc độ khôi phục khi lỗi, mức độ cô lập dữ liệu nhạy cảm (JWT secret, payment key), và khả năng tái tạo môi trường để kiểm thử các luồng nghiệp vụ phức tạp (adaptive decision, reward ledger).

**Nguyên tắc thiết kế:**

1. **Môi trường phải tái tạo được từ đầu:** bất kỳ ai clone repo và chạy một lệnh phải có môi trường giống hệt, không phụ thuộc “máy tôi chạy được”.
2. **Thứ tự khởi động phải được chứng minh bằng healthcheck, không phải bằng sleep:** backend không được khởi động trước khi PostgreSQL và Redis sẵn sàng nhận kết nối.
3. **Secret không được nằm trong image hoặc biến môi trường hiển thị:** JWT signing key, payment gateway secret, database password phải dùng Docker secrets hoặc file mount, không dùng `environment`.
4. **Log phải có vòng đời:** container log không được phép tăng vô hạn; phải có `max-size` và `max-file` để tránh đầy disk trên server production.

---

## 2. Kiến trúc container đề xuất

Dựa trên đặc thù nghiệp vụ của website học ngoại ngữ (frontend đa thiết bị, backend xử lý adaptive và gamification, database lưu tiến độ và reward ledger, Redis cho cache và queue), cấu trúc service như sau:

| Service | Vai trò nghiệp vụ | Ghi chú thiết kế |
|---|---|---|
| `frontend` | Web app (Next.js/React) phục vụ giao diện học, luyện tập, thanh toán | Build multi-stage, image production chỉ chứa static files + Node runtime tối giản |
| `backend-api` | API chính: auth (JWT), learning, adaptive engine, gamification | Không chạy migration tự động khi khởi động; migration là job riêng |
| `backend-worker` | Xử lý bất đồng bộ: tính XP, cập nhật streak, gửi email, đồng bộ reward | Cùng image với `backend-api`, khác command; tách để scale độc lập |
| `postgres` | Lưu user, attempt, learner_model, reward_ledger, entitlement, order | Volume persistent; healthcheck bằng `pg_isready` |
| `redis` | Cache session lookup, rate limit “quá dễ/quá khó”, queue cho worker | Volume optional (cache có thể mất); healthcheck bằng `redis-cli ping` |
| `migrate` | Chạy migration một lần khi deploy | Dùng `depends_on: condition: service_healthy` với PostgreSQL, `restart: "no"` |

**Quyết định nghiệp vụ quan trọng:** `backend-api` và `backend-worker` dùng cùng một image, chỉ khác command. Điều này đảm bảo logic gamification (tính XP, streak) và logic adaptive (cập nhật learner model) không bị lệch phiên bản giữa API và worker. Nếu tách image riêng, có nguy cơ worker chạy quy tắc cũ trong khi API đã deploy quy tắc mới.

---

## 3. Dockerfile: các quyết định cần chốt

### 3.1 Multi-stage build cho frontend và backend

**Vấn đề nghiệp vụ:** image production không được chứa source code, dev dependencies, hay secret. Nếu image chứa source, kẻ tấn công có thể đọc logic adaptive hoặc quy tắc gamification.

**Yêu cầu:**

- Stage `builder` cài toàn bộ dependencies, build artifact.
- Stage `production` chỉ copy artifact và production dependencies.
- Không dùng `COPY . .` ở stage cuối; copy có chọn lọc.

### 3.2 Non-root user

**Vấn đề nghiệp vụ:** nếu container bị chiếm quyền qua lỗ hổng ứng dụng, user root có thể leo thang ra host. Với dữ liệu học tập và reward ledger, đây là rủi ro không chấp nhận được.

**Yêu cầu:** tạo user riêng trong Dockerfile, `USER appuser` trước `CMD`. Không chạy `npm start` hay `node` bằng root.

### 3.3 Không copy secret vào image

**Vấn đề nghiệp vụ:** JWT signing key nếu nằm trong image layer thì bất kỳ ai pull image đều đọc được. Tương tự với payment gateway secret.

**Yêu cầu:** Dockerfile không chứa `ARG` hay `ENV` cho secret. Secret được inject lúc runtime qua Docker secrets hoặc file mount. Biến môi trường chỉ chứa `*_FILE` trỏ đến đường dẫn secret.

---

## 4. Docker Compose: đặc tả nghiệp vụ

### 4.1 Thứ tự khởi động có điều kiện

**Quyết định nghiệp vụ:** backend không được khởi động trước khi PostgreSQL và Redis healthy. Nếu backend khởi động trước, migration hoặc kết nối Redis có thể thất bại, gây lỗi 500 cho người dùng trong vài giây đầu sau deploy.

**Yêu cầu:**

- `postgres`: healthcheck `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}` với `interval: 5s`, `timeout: 5s`, `retries: 5`, `start_period: 10s`.
- `redis`: healthcheck `redis-cli ping` với `interval: 3s`, `retries: 5`.
- `backend-api` và `backend-worker`: `depends_on` với `condition: service_healthy` cho cả `postgres` và `redis`.
- `migrate`: `depends_on` postgres healthy; `restart: "no"` để không chạy lại vô hạn nếu migration lỗi.

**Lưu ý:** `start_period` cho PostgreSQL nên đủ dài (10–30 giây) để initdb hoàn tất lần đầu. Không tăng `retries` để bù cho `start_period` ngắn — điều này che giấu lỗi khởi động chậm thật sự.

### 4.2 Restart policy

| Service | Restart policy | Lý do nghiệp vụ |
|---|---|---|
| `backend-api` | `unless-stopped` | Phải tự phục hồi khi crash; không restart nếu admin chủ động stop |
| `backend-worker` | `unless-stopped` | Xử lý reward/streak không được dừng giữa chừng |
| `postgres` | `unless-stopped` | Database crash phải tự phục hồi |
| `redis` | `unless-stopped` | Cache mất có thể rebuild, nhưng queue không được mất |
| `migrate` | `"no"` | Chỉ chạy một lần; lỗi phải được xử lý thủ công |
| `frontend` | `unless-stopped` | Phục vụ giao diện liên tục |

### 4.3 Secret management

**Quyết định nghiệp vụ:** các secret sau không được nằm trong `environment` của docker-compose (vì `docker compose config` và `docker inspect` đều đọc được):

- `JWT_SIGNING_KEY`
- `REFRESH_TOKEN_HASH_SECRET`
- `PAYMENT_GATEWAY_SECRET`
- `POSTGRES_PASSWORD`

**Cơ chế:** dùng Docker secrets (file mount vào `/run/secrets/`), biến môi trường chỉ chứa `*_FILE` trỏ đến đường dẫn. Ví dụ: `POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password`, `JWT_SIGNING_KEY_FILE=/run/secrets/jwt_key`.

**Lưu ý:** cần chốt với đội vận hành ai có quyền đọc secret file trên server, và quy trình rotate secret khi có nhân sự rời đi. Đây là yêu cầu bảo mật, không phải kỹ thuật.

### 4.4 Logging driver

**Quyết định nghiệp vụ:** log container phải có giới hạn kích thước để tránh đầy disk. Với website học ngoại ngữ, log chủ yếu dùng để debug adaptive decision và audit reward, không cần lưu vô hạn trên container.

**Yêu cầu:** đặt logging driver `local` (hiệu năng tốt hơn `json-file`) với `max-size: "10m"` và `max-file: "3"` cho mỗi service. Tổng log tối đa 30MB/service, đủ cho vài ngày debug.

---

## 5. Resource limits: quyết định theo nghiệp vụ

| Service | CPU limit | Memory limit | Lý do nghiệp vụ |
|---|---|---|---|
| `backend-api` | 1.0 | 1G | Cần đủ RAM cho JWT verification, adaptive engine tính toán, và xử lý request đồng thời |
| `backend-worker` | 0.5 | 512M | Xử lý batch reward/streak; không cần nhiều CPU nhưng cần đủ RAM cho queue |
| `postgres` | 1.0 | 1G | Buffer cache và connection pool; nếu thiếu RAM, query chậm ảnh hưởng trực tiếp đến trải nghiệm làm bài |
| `redis` | 0.5 | 256M | Cache và queue; nếu thiếu RAM, key bị evict gây mất session lookup tạm thời |
| `frontend` | 0.5 | 256M | Chỉ serve static files và SSR nhẹ |

**Quyết định cần chốt:** khi `backend-worker` bị OOM, reward/streak có được xử lý lại tự động không? Nếu không, cần cơ chế dead-letter queue và alert. Đây là yêu cầu nghiệp vụ về tính đúng đắn của XP/streak.

---

## 6. Các quyết định cần chốt

| # | Quyết định | Ảnh hưởng | Khuyến nghị |
|---|---|---|---|
| 1 | Có tách `backend-worker` khỏi `backend-api` ngay từ MVP không? | Độ phức tạp vận hành vs khả năng scale | Tách ngay nếu có xử lý reward bất đồng bộ; nếu chưa, gộp nhưng chuẩn bị interface để tách sau |
| 2 | Secret dùng Docker secrets hay file mount thủ công? | Bảo mật vs đơn giản | Docker secrets nếu deploy trên Swarm; file mount với quyền 600 nếu dùng Compose thuần |
| 3 | Migration chạy tự động hay job riêng? | Rủi ro downtime vs đơn giản | Job riêng (`migrate`), không tự động trong entrypoint của `backend-api` |
| 4 | Log giữ bao lâu trên container? | Debug vs disk | 30MB/service (3 file × 10MB); log dài hạn đẩy ra hệ thống tập trung nếu cần |
| 5 | Resource limit có cứng không hay để Docker tự điều chỉnh? | Ổn định vs linh hoạt | Đặt limit cứng cho production; dev có thể bỏ qua |
| 6 | Có dùng chung network cho tất cả service không? | Cô lập bảo mật vs đơn giản | Tách network: `frontend` chỉ nói chuyện với `backend-api`; `backend-api` và worker nói chuyện với `postgres`/`redis` |
| 7 | Ai chịu trách nhiệm rotate secret? | Vận hành vs bảo mật | Chốt quy trình: định kỳ 90 ngày, và ngay khi có nhân sự rời đi |

---

## 7. Rủi ro nghiệp vụ điển hình nếu Docker làm thiếu

| Rủi ro | Hậu quả | Biện pháp |
|---|---|---|
| Backend khởi động trước PostgreSQL | Migration lỗi, API trả 500 trong vài giây đầu sau deploy | `depends_on: condition: service_healthy` |
| JWT secret nằm trong `environment` | `docker compose config` đọc được → lộ signing key → kẻ tấn công tự tạo token | Dùng secret file, biến môi trường chỉ chứa `*_FILE` |
| Không có healthcheck cho worker | Container “chạy” nhưng worker bị treo → reward không được cấp, streak không cập nhật | Healthcheck endpoint `/healthz/ready` kiểm tra kết nối Redis/DB |
| Log không giới hạn | Disk đầy sau vài tuần → toàn bộ service dừng | `logging: driver: local`, `max-size: 10m`, `max-file: 3` |
| Chạy container bằng root | Lỗ hổng ứng dụng leo thang ra host, đọc được secret | `USER appuser` trong Dockerfile |
| Image chứa source code và dev dependencies | Kẻ tấn công đọc logic adaptive/gamification, tìm cách farm XP | Multi-stage build, production stage chỉ copy artifact |

---

## 8. Cấu trúc tài liệu Docker cho đội phát triển

Nên tách thành ba lớp:

1. **Sơ đồ service và luồng khởi động:** service nào phụ thuộc service nào, healthcheck nào gate service nào.
2. **Bảng secret và quyền truy cập:** secret nào, ai đọc, rotate khi nào, lưu ở đâu.
3. **Bảng quyết định vận hành:** restart policy, resource limit, logging, migration — kèm lý do nghiệp vụ cho từng quyết định (không chỉ giá trị kỹ thuật).
