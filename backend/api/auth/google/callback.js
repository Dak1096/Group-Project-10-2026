import jwt from 'jsonwebtoken'
import { prisma } from '../../../server/core/db.js'

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    // 1. Đổi code lấy access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();

    // 2. Lấy thông tin user
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    // 3. Lưu vào Database bằng Prisma
    let user = await prisma.user.findUnique({ where: { email: userData.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: 'OAUTH_USER_NO_PASSWORD',
        }
      });
    }

    // 4. Tạo JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email }, 
      process.env.SESSION_SECRET || 'fallback_secret', 
      { expiresIn: '1d' }
    );

    // 5. Chuyển hướng về Frontend kèm token
    res.redirect(`/login?next=/practice&token=${token}&email=${encodeURIComponent(user.email)}`);
    
  } catch (error) {
    res.status(500).json({ error: 'Google Auth Failed: ' + error.message });
  }
}