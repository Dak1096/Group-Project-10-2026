import jwt from 'jsonwebtoken'
import { prisma } from '../../../server/core/db.js'

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    // 1. Đổi code lấy access token từ Facebook
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${process.env.APP_URL}/api/auth/facebook/callback&client_secret=${process.env.FACEBOOK_APP_SECRET}&code=${code}`);
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // 2. Lấy thông tin user từ Facebook
    const userRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`);
    const userData = await userRes.json();

    if (!userData.email) throw new Error('Facebook account has no email');

    // 3. Lưu vào Database bằng Prisma
    let user = await prisma.user.findUnique({ where: { email: userData.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: 'OAUTH_USER_NO_PASSWORD', // Mật khẩu giả vì đăng nhập qua OAuth
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
    res.status(500).json({ error: 'Facebook Auth Failed: ' + error.message });
  }
}