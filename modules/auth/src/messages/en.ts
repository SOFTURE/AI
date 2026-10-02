export const en = {
  fields: {
    email: "Email",
    password: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    newPasswordHint: "At least {minLength} characters.",
    consent: "I accept the terms of service and the privacy policy.",
  },
  login: {
    title: "Log in",
    lead: "Welcome back.",
    submit: "Log in",
    pending: "Logging in…",
    noAccount: "No account yet?",
    registerLink: "Create one",
  },
  register: {
    title: "Create an account",
    lead: "It takes a minute.",
    submit: "Create account",
    pending: "Creating…",
    hasAccount: "Already have an account?",
    loginLink: "Log in",
    closedTitle: "Registration is closed",
    closedBody: "New accounts cannot be created right now. Try again later.",
  },
  changePassword: {
    title: "Change password",
    lead: "Every other device you are logged in on will be logged out.",
    submit: "Change password",
    pending: "Saving…",
    success: "Your password has been changed.",
  },
  logout: {
    submit: "Log out",
  },
  errors: {
    auth: {
      invalid_credentials: "The email or password is incorrect.",
      email_invalid: "Enter a valid email address.",
      email_taken: "An account with this email already exists.",
      password_too_short: "The password is too short.",
      password_too_long: "The password is too long.",
      consent_required: "You need to accept the terms to create an account.",
      registration_closed: "Registration is closed.",
      current_password_invalid: "The current password is incorrect.",
      unauthenticated: "Your session has ended. Log in again.",
    },
    security: {
      rate_limited: "Too many attempts. Wait a few minutes and try again.",
      client_unidentified: "We could not verify where this request came from. Try again later.",
    },
    core: {
      database_failed: "Something went wrong on our side. Try again in a moment.",
      unexpected: "Something went wrong on our side. Try again in a moment.",
    },
  },
};
