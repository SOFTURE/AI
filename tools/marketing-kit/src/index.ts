// Public API of @softure-ai/marketing-kit: the film model a project's film modules are typed with,
// and the pure building blocks of the pipeline (voiceover cache, timeline, composition, posts).
// The `softure-marketing` CLI (`src/cli/main.ts`) runs the whole pipeline from a config file.
export {
  CUES,
  PLATFORMS,
  containsPhrase,
  isChannelCode,
  sceneBeats,
  validateFilm,
  type Beat,
  type CueName,
  type Director,
  type EndCard,
  type Film,
  type HookShot,
  type Persona,
  type Platform,
  type PostCopy,
  type VoiceSettings,
} from "./film.js";
export {
  ELEVENLABS_API_URL,
  ELEVENLABS_DEFAULT_MODEL,
  ELEVENLABS_DEFAULT_VOICE,
  buildTtsRequest,
  readTimestampsResponse,
  splitIntoBeats,
  voiceoverKey,
  voiceoverText,
  wordsFromAlignment,
  type BeatVoice,
  type CharacterAlignment,
  type TimedWord,
  type TtsRequest,
} from "./voice/voiceover.js";
export {
  CAMERA_TARGET,
  FRAME,
  SCREEN,
  SCREEN_HEIGHT,
  SCREEN_SCALE,
  VIEWPORT,
  cameraPose,
  captionChunks,
  fitScale,
  rewindFrames,
  unionRect,
  widePose,
  type CameraPose,
  type CaptionChunk,
  type Rect,
} from "./compose/timeline.js";
export {
  composeFilm,
  filmTimes,
  resolveCameraTweens,
  type CameraTween,
  type ComposeAssets,
  type ComposeInput,
  type ResolvedTween,
} from "./compose/compose.js";
export { SITE_COLOR_TOKENS, readSiteTokens, type SiteColorToken, type SiteTokens } from "./compose/site-tokens.js";
export { buildPosts, channelLink, postsMarkdown, type PlatformPost, type PostsOptions } from "./posts/posts.js";
export { FPS, ScreenGuardError, type CameraCue, type RecordingLog } from "./record/record.js";
export {
  MARKETING_LOCALES,
  formatMessage,
  getMarketingMessages,
  marketingMessages,
  type MarketingLocale,
  type MarketingMessages,
} from "./messages/index.js";
