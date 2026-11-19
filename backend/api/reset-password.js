import { resetPassword } from '../server/modules/auth/auth.service.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, newPassword } = req.body
  if (!email || !newPassword) return res.status(400).json({ error: 'Missing fields' })

  try {
    await resetPassword(email, newPassword)
    res.status(200).json({ success: true, message: 'Password updated!' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}