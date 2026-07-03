const WEAK_PASSWORDS = new Set([
  "123456",
  "password",
  "qwerty",
  "12345678",
  "111111",
  "123456789",
  "1234567",
  "12345",
  "123123",
  "abc123",
  "password1",
  "qwerty123",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_REGEX.test(email.trim());
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Choose a stronger one.";
  }

  return "";
}

export function validateSignup({ fullName, email, password, confirmPassword, officeName }) {
  if (!fullName?.trim()) {
    return "Please enter your full name.";
  }

  if (!officeName?.trim()) {
    return "Please enter your office name.";
  }

  if (!isValidEmail(email || "")) {
    return "Please enter a valid email address.";
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return passwordError;
  }

  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return "";
}

export function validateLogin({ email, password }) {
  if (!isValidEmail(email || "")) {
    return "Please enter a valid email address.";
  }

  if (!password) {
    return "Please enter your password.";
  }

  return "";
}
