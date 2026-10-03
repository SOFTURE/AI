// Public API of @softure-ai/marketing-kit: the `marketing.json` contract (schema, loading, brand
// colours), the film model a project's scene modules are typed with, and the pure building blocks of
// the pipeline (TTS providers, voiceover cache, timeline, composition, posts, OG images). OG images also
// have their own entry, `@softure-ai/marketing-kit/og`, for routes that must not load Playwright. The `softure-marketing` CLI
// (`src/cli/main.ts`) runs the whole pipeline from `marketing.json`.
export {
  DEFAULT_CONFIG_FILE,
  MARKETING_SCHEMA_URL,
  QUALITIES,
  SFX_EVENTS,
  getMarketingJsonSchema,
  marketingSchema,
  type MarketingJson,
  type MarketingJsonInput,
  type Quality,
  type SfxEvent,
} from "./config/schema.js";
export {
  findMissingFiles,
  findVideo,
  loadMarketingConfig,
  type BrandFont,
  type FontFile,
  type LoadConfigResult,
  type MarketingConfig,
  type PlatformChannel,
  type VideoConfig,
  type VideoPost,
} from "./config/config.js";
export { COLOR_ROLES, COLOR_THEMES, type BrandColors, type ColorRole, type ColorTheme, type ColorsResult } from "./config/colors.js";
export { resolveBrandColors, type BrandColorsResult } from "./config/brand.js";
export { readCssColors } from "./config/css-colors.js";
export { readDesignJsonColors } from "./config/design-json.js";
export { formatIssuePath, type ConfigIssue } from "./config/issues.js";
export {
  CUES,
  containsPhrase,
  sceneBeats,
  type Beat,
  type CueName,
  type Device,
  type Director,
  type EndCard,
  type Film,
  type FilmScript,
  type HookShot,
  type Persona,
  type Scene,
  type VoiceSettings,
} from "./film.js";
export { CHANNEL_CODE_MAX_LENGTH, CHANNEL_CODE_PATTERN, DEFAULT_LINK_IN_BIO, PLATFORMS, channelLink, isChannelCode, type Platform } from "./platforms.js";
export {
  ELEVENLABS_API_URL,
  ELEVENLABS_DEFAULT_MODEL,
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
export type { TtsEstimate, TtsInput, TtsProvider, TtsRecording, TtsResult } from "./voice/provider.js";
export { ELEVENLABS_API_KEY_ENV, ELEVENLABS_PROVIDER_ID, createElevenLabsProvider, type ElevenLabsOptions } from "./voice/elevenlabs.js";
export { createFakeTtsProvider, type FakeTtsOptions, type FakeTtsProvider } from "./voice/fake.js";
export { createTtsProvider, type CreateTtsProviderOptions, type TtsProviderId } from "./voice/providers.js";
export { getVoiceoverPaths, readCachedVoiceover, writeVoiceover, type Voiceover, type VoiceoverPaths } from "./voice/cache.js";
export { describeEstimate, produceVoiceover, type ProduceVoiceoverOptions, type VoiceoverOutcome } from "./voice/produce.js";
export {
  VIDEO_FORMATS,
  cameraPose,
  captionChunks,
  fitScale,
  fitsFrame,
  getGeometry,
  rewindFrames,
  unionRect,
  widePose,
  type CameraPose,
  type CaptionChunk,
  type Geometry,
  type Rect,
  type VideoFormat,
  type Viewport,
} from "./compose/timeline.js";
export {
  composeFilm,
  filmTimes,
  resolveCameraTweens,
  type CameraTween,
  type ComposeAssets,
  type ComposeFont,
  type ComposeInput,
  type FontFace,
  type ResolvedTween,
} from "./compose/compose.js";
export {
  DEFAULT_OG_SIZE,
  OG_TEMPLATE_IDS,
  getOgPalette,
  loadOgFonts,
  renderConfiguredOgImage,
  renderOgImage,
  type ConfiguredOgImageOptions,
  type OgBrand,
  type OgImageInput,
  type OgResult,
  type OgTemplateId,
} from "./og/index.js";
export { buildPosts, postsMarkdown, type PlatformPost, type PostsInput } from "./posts/posts.js";
export { FPS, ScreenGuardError, type BrowserSettings, type CameraCue, type RecordingLog } from "./record/record.js";
export {
  MARKETING_LOCALES,
  formatMessage,
  getMarketingMessages,
  marketingMessages,
  type MarketingLocale,
  type MarketingMessages,
} from "./messages/index.js";
