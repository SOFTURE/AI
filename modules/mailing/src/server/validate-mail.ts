// The boundary check of `sendMail`: a mail and its options are parsed before anything leaves the
// process. Failures name the fields, never their values (an address is personal data).
import { z } from "zod";
import { hasLineBreak, isHeaderName, isIdempotencyKey, isListMailHeader, isMailKind, isReservedHeader, isSingleAddress, MAX_SUBJECT_LENGTH } from "../address.js";
import { DEFAULT_ATTACHMENT_LIMITS, getContentTypeEssence, isAttachmentFilename, isContentType, type AttachmentLimits } from "../attachments.js";
import { TRANSACTIONAL_KIND, type MailAttachment } from "../contract.js";

const headersSchema = z.record(z.string(), z.string()).superRefine((headers, context) => {
  for (const [name, value] of Object.entries(headers)) {
    if (!isHeaderName(name) || isReservedHeader(name) || hasLineBreak(value)) {
      context.addIssue({ code: "custom", message: "invalid or reserved header" });
    }
  }
});

const attachmentSchema = z.object({
  filename: z.string().refine(isAttachmentFilename),
  contentType: z.string().trim().refine(isContentType),
  // A Node Buffer is a Uint8Array too; an empty file is almost always a caller's bug.
  content: z.custom<Uint8Array>((value) => value instanceof Uint8Array && value.byteLength > 0),
});

/** The attachments within `limits`: count, total bytes and an allowed content type for each. */
function createAttachmentsSchema(limits: AttachmentLimits) {
  const allowed = new Set(limits.contentTypes);
  return z
    .array(attachmentSchema)
    .max(limits.maxCount)
    .refine((attachments) => attachments.every((attachment) => allowed.has(getContentTypeEssence(attachment.contentType))))
    .refine((attachments) => attachments.reduce((total, attachment) => total + attachment.content.byteLength, 0) <= limits.maxTotalBytes);
}

const mailFields = {
  to: z.string().trim().refine(isSingleAddress),
  subject: z
    .string()
    .refine((subject) => subject.trim() !== "" && subject.length <= MAX_SUBJECT_LENGTH && !hasLineBreak(subject)),
  text: z.string().refine((text) => text.trim() !== ""),
  html: z
    .string()
    .refine((html) => html.trim() !== "")
    .optional(),
  headers: headersSchema.optional(),
  replyTo: z.string().trim().refine(isSingleAddress).optional(),
  kind: z.string().refine(isMailKind).default(TRANSACTIONAL_KIND),
};

function createMailSchema(limits: AttachmentLimits) {
  return z.object({ ...mailFields, attachments: createAttachmentsSchema(limits).optional() }).superRefine((mail, context) => {
    // The module writes these two on list mail; a second, unsigned copy would confuse clients.
    if (mail.kind !== TRANSACTIONAL_KIND && Object.keys(mail.headers ?? {}).some(isListMailHeader)) {
      context.addIssue({ code: "custom", path: ["headers"], message: "list mail gets its unsubscribe headers from the module" });
    }
  });
}

/** One schema per limits object: the configured limits are parsed once per config, so this builds each once. */
const mailSchemas = new WeakMap<AttachmentLimits, ReturnType<typeof createMailSchema>>();

function getMailSchema(limits: AttachmentLimits): ReturnType<typeof createMailSchema> {
  let schema = mailSchemas.get(limits);
  if (schema === undefined) {
    schema = createMailSchema(limits);
    mailSchemas.set(limits, schema);
  }
  return schema;
}

const optionsSchema = z.object({
  idempotencyKey: z.string().refine(isIdempotencyKey).optional(),
});

export interface ValidMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string | null;
  readonly headers: Readonly<Record<string, string>>;
  /** The mail's own reply-to; null to use the configured one. */
  readonly replyTo: string | null;
  /** `transactional` or a list kind. */
  readonly kind: string;
  readonly idempotencyKey: string | null;
  /** Empty when the mail has none. */
  readonly attachments: readonly MailAttachment[];
}

export type MailValidation = { readonly ok: true; readonly value: ValidMail } | { readonly ok: false; readonly fields: readonly string[] };

/**
 * Checks one mail and its send options, its attachments against `limits` (default: the module's defaults; `sendMail`
 * passes the configured ones). `fields` lists what failed (`to`, `subject`, `text`, `html`, `headers`, `replyTo`,
 * `kind`, `attachments`, `idempotencyKey`, or `mail` when the input is not an object).
 */
export function validateMail(mail: unknown, options: unknown = {}, limits: AttachmentLimits = DEFAULT_ATTACHMENT_LIMITS): MailValidation {
  const parsedMail = getMailSchema(limits).safeParse(mail);
  const parsedOptions = optionsSchema.safeParse(options ?? {});
  if (!parsedMail.success || !parsedOptions.success) {
    const issues = [...(parsedMail.error?.issues ?? []), ...(parsedOptions.error?.issues ?? [])];
    const fields = new Set(issues.map((issue) => (issue.path.length === 0 ? "mail" : String(issue.path[0]))));
    return { ok: false, fields: [...fields] };
  }
  const { to, subject, text, html, headers, replyTo, kind, attachments = [] } = parsedMail.data;
  return {
    ok: true,
    value: {
      to,
      subject,
      text,
      html: html ?? null,
      headers: headers ?? {},
      replyTo: replyTo ?? null,
      kind,
      idempotencyKey: parsedOptions.data.idempotencyKey ?? null,
      attachments,
    },
  };
}
