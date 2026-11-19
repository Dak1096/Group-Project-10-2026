// 1. Import PrismaClient từ node_modules
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis

// 2. Tạo pool kết nối bằng thư viện pg
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL 
})

// 3. Tạo adapter từ pool
const adapter = new PrismaPg(pool)

// 4. Khởi tạo PrismaClient với adapter
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma