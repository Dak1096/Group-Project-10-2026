import { login } from '../server/modules/auth/auth.service.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  try {
    const data = await login(email, password)
    res.status(200).json({ success: true, ...data })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
}