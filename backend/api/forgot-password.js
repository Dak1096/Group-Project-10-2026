import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Please enter your email.' });

  try {
    const { data, error } = await resend.emails.send({
      from: 'EnglishStep <onboarding@resend.dev>', 
      to: email,
      subject: 'Password Reset - EnglishStep',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your EnglishStep account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="https://jwt-code-ug7n.vercel.app/reset-password?email=${encodeURIComponent(email)}" 
             style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
            Reset Password
          </a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}