import { prisma } from '../server/core/db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { courseSlug } = req.query;

  try {
    const questions = await prisma.question.findMany({
      where: {
        lesson: {
          course: { slug: courseSlug || 'ielts' }
        }
      },
      take: 10,
      select: {
        id: true,
        text: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        difficulty: true
        // Đã xóa correctAns và explanation để bảo mật
      }
    })

    res.status(200).json(questions)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}