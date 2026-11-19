import { prisma } from '../../core/db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.SESSION_SECRET || 'fallback_secret'

// Hàm đổi mật khẩu
export const resetPassword = async (email, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  return await prisma.user.update({
    where: { email },
    data: { password: hashedPassword }
  })
}

// Hàm đăng nhập
export const login = async (email, password) => {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('User not found')

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) throw new Error('Invalid password')

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' })
  return { token, user: { id: user.id, email: user.email, name: user.name } }
}