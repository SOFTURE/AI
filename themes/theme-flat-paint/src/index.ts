// The Flat Paint theme: tokens, cn and the look of the @softure-ai/ui components in this design system.
// The stylesheets are separate entries: `@softure-ai/theme-flat-paint/theme.css`, `/sft-bridge.css` and `/page.css`.
export { FLAT_PAINT_THEME, theme } from "./tokens.js";
export { cn } from "./lib/utils.js";

export {
  BUTTON_VARIANT_LOOK,
  ICON_BUTTON_SIZE_LOOK,
  ICON_BUTTON_TONE_LOOK,
  getIconButtonLook,
  type ButtonVariant,
  type IconButtonSize,
  type IconButtonTone,
} from "./look/button.js";
export {
  CARD_ROOT_LOOK,
  CARD_STEP_LOOK,
  CARD_TITLE_LOOK,
  FIELD_LABEL_LOOK,
  STAT_SECONDARY_LOOK,
  STAT_VALUE_LOOK,
  type CardHeading,
  type CardVariant,
  type StatSize,
} from "./look/card.js";
export {
  CHECKBOX_LOOK,
  SEGMENTED_GROUP_LOOK,
  SEGMENT_ACTIVE_LOOK,
  SEGMENT_ACTIVE_WHEN_CURRENT_LOOK,
  SEGMENT_IDLE_LOOK,
  SWITCH_INPUT_LOOK,
  SWITCH_KNOB_LOOK,
  SWITCH_TRACK_LOOK,
  type CheckboxSlot,
} from "./look/controls.js";
export { MODAL_LOOK, STANDING_PANEL_LOOK, getModalLook, type ModalLook, type ModalSlot, type ModalWidth } from "./look/modal.js";
export { ROLE_TONE, type DataRole, type UiTone } from "./look/roles.js";
