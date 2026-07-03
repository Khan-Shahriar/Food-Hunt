export async function sendVerificationEmail(email, fullName, verifyUrl) {
  console.log("\n--- Verification email ---");
  console.log(`To: ${email}`);
  console.log(`Hi ${fullName}, verify your Food Hunt account:`);
  console.log(verifyUrl);
  console.log("--------------------------\n");
}

export async function sendPasswordResetEmail(email, fullName, resetUrl) {
  console.log("\n--- Password reset email ---");
  console.log(`To: ${email}`);
  console.log(`Hi ${fullName}, reset your Food Hunt password:`);
  console.log(resetUrl);
  console.log("----------------------------\n");
}
