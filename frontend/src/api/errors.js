// Mã lỗi theo ngữ nghĩa nghiệp vụ (bảng mã lỗi trong đặc tả OpenAPI).
// Body lỗi thống nhất: { error: { code, message, traceId, details } }
export class ApiError extends Error {
  constructor(code, status, message, details, traceId) {
    super(message || code)
    this.code = code
    this.status = status
    this.details = details
    this.traceId = traceId // hiển thị cho người dùng khi cần báo CSKH
  }
}

// Mất mạng / không gọi được server: KHÁC lỗi nghiệp vụ, vì kết quả có thể lưu nháp và đồng bộ lại.
export class NetworkError extends Error {
  constructor() {
    super('NETWORK')
    this.code = 'NETWORK'
  }
}
