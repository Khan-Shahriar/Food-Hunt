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


export function validateOfferFields({
  restaurantName,
  foodName,
  foodDescription,
  quantity,
  foodPrice,
  deliveryCharge,
  startTime,
  endTime,
  maxPeople
}) {
  if (typeof restaurantName !== "string" || !restaurantName.trim()) {
    return "Restaurant name is required.";
  }

  if (restaurantName.trim().length > 120) {
    return "Restaurant name is too long.";
  }

  if (typeof foodName !== "string" || !foodName.trim()) {
    return "Food name is required.";
  }

  if (foodName.trim().length > 160) {
    return "Food name is too long.";
  }

  if (
    foodDescription !== undefined &&
    foodDescription !== null &&
    typeof foodDescription !== "string"
  ) {
    return "Food description must be text.";
  }

  if (typeof foodDescription === "string" && foodDescription.length > 1000) {
    return "Food description is too long.";
  }

  const normalizedQuantity = Number(quantity);
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    return "Quantity must be a positive integer.";
  }

  const normalizedFoodPrice = Number(foodPrice);
  if (!Number.isFinite(normalizedFoodPrice) || normalizedFoodPrice < 0) {
    return "Food price must be a valid non-negative number.";
  }

  const normalizedDeliveryCharge = Number(deliveryCharge);
  if (!Number.isFinite(normalizedDeliveryCharge) || normalizedDeliveryCharge < 0) {
    return "Delivery charge must be a valid non-negative number.";
  }

  if (normalizedFoodPrice > 100000000 || normalizedDeliveryCharge > 100000000) {
    return "Price values are too large.";
  }

  if (!startTime) return "Start time is required.";
  if (!endTime) return "End time is required.";

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime())) return "Start time is invalid.";
  if (Number.isNaN(end.getTime())) return "End time is invalid.";

  if (end <= start) {
    return "End time must be after start time.";
  }

  const normalizedMaxPeople = Number(maxPeople);
  if (!Number.isInteger(normalizedMaxPeople) || normalizedMaxPeople <= 0) {
    return "Maximum participants must be a positive integer.";
  }

  if (normalizedMaxPeople > 10000) {
    return "Maximum participants is too large.";
  }

  return "";
}

export function validatePaymentMethods(paymentMethods) {
    if (
        !paymentMethods ||
        typeof paymentMethods !== "object" ||
        Array.isArray(paymentMethods)
    ) {
        return "Payment methods are required.";
    }

    const bkashEnabled =
        paymentMethods.bkash?.enabled === true;

    const cityBankEnabled =
        paymentMethods.cityBank?.enabled === true;

    const cashEnabled =
        paymentMethods.cash?.enabled === true;

    if (!bkashEnabled && !cityBankEnabled && !cashEnabled) {
        return "At least one payment method is required.";
    }

    return "";
}
