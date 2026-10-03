// The waitlist form, to compose into the app's own page. It takes the join action from
// `@softure-ai/waitlist/next` as a prop: no `next/*` import here (docs/02-module-standard.md §5).
// `Waitlist` in `/next` renders it wired to the registered config.
export {
  WaitlistForm,
  type WaitlistFormAction,
  type WaitlistFormProps,
  type WaitlistFormScope,
  type WaitlistFormSlot,
} from "./waitlist-form.js";
