import nodemailer from 'nodemailer';

export async function enviarEmailResetPin(email, nombre, resetUrl) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER y EMAIL_PASS no están configurados');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo img { height: 80px; }
    h1 { color: #2d3142; font-size: 20px; margin-bottom: 16px; }
    p { color: #495057; font-size: 15px; line-height: 1.6; }
    .button { display: block; width: 100%; background: #3b82f6; color: #fff; text-decoration: none; text-align: center; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px; }
    .warning { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px; margin: 16px 0; font-size: 13px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="https://frontend-auto.bph-backend-esqueleto.workers.dev/LogoNexocorp.png" alt="Nexocorp">
    </div>
    <h1>Recuperación de PIN</h1>
    <p>Hola <strong>${nombre}</strong>,</p>
    <p>Has solicitado restablecer tu PIN del Sistema BPH. Haz clic en el botón de abajo para establecer un nuevo PIN. El enlace expira en 15 minutos.</p>
    <a href="${resetUrl}" class="button">Restablecer PIN ahora</a>
    <div class="warning">
      Si no solicitaste este cambio, ignora este email. Tu PIN no se modificará.
    </div>
    <div class="footer">
      Sistema BPH — Control de Calidad Nexocorp
    </div>
  </div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"Soporte BPH" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Recuperación de PIN — Sistema BPH',
    html,
  });
}
