import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Bắt đầu nạp dữ liệu...')

  // 1. Tạo khóa học IELTS
  const ielts = await prisma.course.upsert({
    where: { slug: 'ielts' },
    update: {},
    create: { slug: 'ielts', title: 'IELTS Preparation' },
  })

  // 2. Tạo bài học
  const lesson1 = await prisma.lesson.create({
    data: { title: 'Vocabulary Unit 1', courseId: ielts.id },
  })

  // 3. Tạo câu hỏi
  await prisma.question.createMany({
    data: [
      {
        text: "Doctors still don't know the cause _____ his headaches.",
        optionA: "from", optionB: "about", optionC: "of", optionD: "to",
        correctAns: "C", explanation: "Cấu trúc: the cause of something.", 
        difficulty: 2, lessonId: lesson1.id,
      },
      {
        text: "She made a ____ to study every day.",
        optionA: "decision", optionB: "commitment", optionC: "mistake", optionD: "promise",
        correctAns: "B", explanation: "Make a commitment: cam kết làm gì đó.", 
        difficulty: 3, lessonId: lesson1.id,
      },
      {
        text: "I look forward _____ seeing you.",
        optionA: "to", optionB: "for", optionC: "at", optionD: "in",
        correctAns: "A", explanation: "Cấu trúc: look forward to + V-ing.", 
        difficulty: 1, lessonId: lesson1.id,
      }
    ]
  })

  console.log('Nạp dữ liệu thành công!')
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect())