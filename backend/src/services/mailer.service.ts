// Email delivery stub. Swap the console.log for Resend/Nodemailer before launch —
// the call sites won't need to change.

interface MailOptions {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(options: MailOptions): Promise<void> {
  console.log(
    `[mailer] To: ${options.to} | Subject: ${options.subject}\n${options.text}`
  );
}

export function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/reset-password?token=${resetToken}`;
  return sendMail({
    to,
    subject: "Reset your Smart POS password",
    text: `You requested a password reset. This link is valid for 1 hour:\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
  });
}
