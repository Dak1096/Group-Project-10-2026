export default function handler(req, res) {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.APP_URL}/api/auth/facebook/callback`;
  
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=email`;

  res.redirect(url);
}