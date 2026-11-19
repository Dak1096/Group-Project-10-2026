import { prisma } from '../server/core/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { questionId, selectedAnswer } = req.body;
  
  if (!questionId || !selectedAnswer) {
    return res.status(400).json({ error: 'Missing questionId or selectedAnswer' });
  }

  try {
    // 1. Tìm câu hỏi trong Database
    const question = await prisma.question.findUnique({
      where: { id: Number(questionId) }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // 2. So sánh đáp án (Server tự kiểm tra, không lộ đáp án ra ngoài)
    const isCorrect = question.correctAns === selectedAnswer;

    // 3. Trả về kết quả (không trả về correctAns)
    res.status(200).json({
      isCorrect,
      explanation: question.explanation || 'Không có giải thích cho câu hỏi này.',
      // Nếu sai, có thể trả về đáp án đúng để người dùng biết
      correctAnswer: isCorrect ? undefined : question.correctAns 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}