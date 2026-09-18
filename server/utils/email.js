import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return transporter;
}

export async function sendVerificationEmail(email, fullName, verifyUrl) {
  const mailer = getTransporter();

  if (!mailer) {
    console.log("\n--- Verification email ---");
    console.log(`To: ${email}`);
    console.log(`Hi ${fullName}, verify your Food Hunt account:`);
    console.log(verifyUrl);
    console.log("--------------------------\n");
    return;
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to: email,
    subject: "Verify your Food Hunt account",
    text: `Hi ${fullName}, verify your Food Hunt account: ${verifyUrl}`,
    html: `<p>Hi ${fullName},</p><p>Verify your Food Hunt account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function sendPasswordResetOtpEmail(email, fullName, otp) {
  const mailer = getTransporter();

  if (!mailer) {
    console.log("\n--- Password reset OTP ---");
    console.log(`To: ${email}`);
    console.log(`Hi ${fullName}, your Food Hunt password reset code is: ${otp}`);
    console.log("Expires in 10 minutes.");
    console.log("--------------------------\n");
    return;
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to: email,
    subject: "Your Food Hunt password reset code",
    text: `Your Food Hunt password reset code is ${otp}. It expires in 10 minutes.`,
    html: `<div style="font-family:Arial,sans-serif"><h2>Food Hunt</h2><p>Your password reset code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div><p>This code expires in 10 minutes.</p></div>`,
  });
}

export async function sendPasswordResetEmail(email, fullName, resetUrl) {
  const mailer = getTransporter();

  if (!mailer) {
    console.log("\n--- Password reset email ---");
    console.log(`To: ${email}`);
    console.log(`Hi ${fullName}, reset your Food Hunt password:`);
    console.log(resetUrl);
    console.log("----------------------------\n");
    return;
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
    to: email,
    subject: "Reset your Food Hunt password",
    text: `Hi ${fullName}, reset your Food Hunt password: ${resetUrl}`,
    html: `<p>Hi ${fullName},</p><p>Reset your Food Hunt password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
}
