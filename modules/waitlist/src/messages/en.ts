export const en = {
  form: {
    email: "Email",
    submit: "Join the waitlist",
    pending: "Joining…",
    success: "You are on the list. Thank you!",
    confirmationSent: "Almost there: we sent you an email. Open the link in it to confirm your address and join the list.",
    unsubscribeHint: "Keep this link: it takes you off the list whenever you want.",
    unsubscribeLink: "Unsubscribe",
  },
  confirmationMail: {
    subject: "Confirm your place on the waitlist",
    text: "Hello,\n\nsomeone, hopefully you, asked to join the waitlist with this address. Open the link below and confirm to join. If it was not you, ignore this email: without the confirmation the address is not added.",
    action: "Confirm my sign-up",
  },
  confirm: {
    title: "Confirm your sign-up",
    lead: "Confirm that you want to join the waitlist with the address this link was sent to.",
    submit: "Confirm",
    doneTitle: "You are on the list",
    doneBody: "Thank you for confirming. We will write to you as soon as we open.",
    invalidTitle: "This link does not work",
    invalidBody: "It is incomplete or a newer one was sent. Use the link from the latest email, or sign up again.",
    expiredTitle: "This link has expired",
    expiredBody: "Sign up again and we will send you a new one.",
    failed: "Something went wrong on our side. Try again in a moment.",
    limited: "Too many attempts. Wait a few minutes and try again.",
  },
  welcomeMail: {
    subject: "You are on the waitlist",
    text: "Hello,\n\nthank you for joining the waitlist. We will write to you as soon as we open.",
  },
  errors: {
    waitlist: {
      email_invalid: "Enter a valid email address.",
      consent_required: "Check the box to join the waitlist.",
      form_invalid: "This form is out of date. Reload the page and try again.",
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
