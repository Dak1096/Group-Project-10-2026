// Đo lường (§5): mỗi tương tác gamification / quyết định adaptive đều đi qua đây.
// Thay console.debug bằng SDK analytics khi cần.
export function track(event, props = {}) {
  console.debug('[track]', event, props)
}
