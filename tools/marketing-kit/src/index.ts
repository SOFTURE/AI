// Public API of @softure-ai/marketing-kit: the `marketing.json` contract (schema, loading, brand
// colours), the film model a project's scene modules are typed with, the declarative scene actions,
// and the pure building blocks of the pipeline (TTS providers, voiceover cache, timeline, composition,
// posts, OG images, screenshots), and the footage film's blocks (probe, normalize, speech to text, EDL,
// ducked music, composition, `renderFootageFilm`). OG images also have their own entry, `@softure-ai/marketing-kit/og`,
// for routes that must not load Playwright. The `softure-marketing` CLI
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
  ACTION_NAMES,
  ARIA_ROLES,
  actionSchema,
  locatorSchema,
  textMatchSchema,
  type ActionName,
  type AriaRole,
  type LocatorDescriptor,
  type SceneAction,
  type SceneActionInput,
  type TextMatch,
} from "./config/actions-schema.js";
export {
  findFootage,
  findMissingFiles,
  findMissingFootageFiles,
  findVideo,
  type FootageConfig,
  loadMarketingConfig,
  type BrandFont,
  type FontFile,
  type LoadConfigResult,
  type MarketingConfig,
  type ActionBeat,
  type PlatformChannel,
  type SceneSource,
  type VideoConfig,
  type VideoPost,
} from "./config/config.js";
export { COLOR_ROLES, COLOR_THEMES, type BrandColors, type ColorRole, type ColorTheme, type ColorsResult } from "./config/colors.js";
export { resolveBrandColors, type BrandColorsResult } from "./config/brand.js";
export { readCssColors } from "./config/css-colors.js";
export { readDesignJsonColors } from "./config/design-json.js";
export { expandUnionIssues, formatIssuePath, type ConfigIssue, type SchemaIssue } from "./config/issues.js";
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
export { findStaleVoiceovers, getVoiceoverPaths, readCachedVoiceover, writeVoiceover, type Voiceover, type VoiceoverPaths } from "./voice/cache.js";
export { describeCharge, describeEstimate, produceVoiceover, type ProduceVoiceoverOptions, type VoiceoverOutcome } from "./voice/produce.js";
export { findLastRecordingTime, waitForPace, type PaceOptions } from "./voice/pace.js";
export { describeVoiceoverBatch, produceVoiceovers, type VoiceoverBatchItem, type VoiceoverBatchResult } from "./voice/batch.js";
export { getPlaceholderKey, isPlaceholderKey, makePlaceholderWords, writePlaceholderVoiceover, type PlaceholderPace, type WritePlaceholderOptions } from "./voice/placeholder.js";
export {
  BROWSER_BAR_HEIGHT,
  DEVICE_KINDS,
  LAYOUTS,
  LAYOUT_NAMES,
  MIN_DESKTOP_WIDTH,
  TRANSITIONS,
  VIDEO_FORMATS,
  cameraPose,
  captionChunks,
  crossfadeArgs,
  fitScale,
  fitsFrame,
  getGeometry,
  getLayoutName,
  getTransitionSeconds,
  isDesktopViewport,
  resolveLayout,
  rewindFrames,
  transitionFrames,
  unionRect,
  widePose,
  type CameraPose,
  type CaptionChunk,
  type CaptionLayout,
  type CrossfadeInput,
  type DeviceKind,
  type EndCardLayout,
  type Geometry,
  type Layout,
  type LayoutName,
  type LayoutOverride,
  type Point,
  type Rect,
  type Transition,
  type TextBox,
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
  countOgSlides,
  getDefaultOgSize,
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
export { createActionScene, getLocator, runAction, type LocatorSource } from "./record/actions.js";
export { FPS, ScreenGuardError, type BrowserSettings, type CameraCue, type RecordingLog } from "./record/record.js";
export {
  getScreenshotFile,
  takePageScreenshot,
  takeScreenshots,
  type ScreenshotBrowser,
  type ScreenshotEntry,
  type ScreenshotResult,
  type TakePageScreenshotOptions,
  type TakeScreenshotsOptions,
} from "./screenshot/screenshot.js";
export { MIN_FAILING_STATUS, SCREENSHOT_GATES, findScrollFailure, findSizeFailure, findStatusFailure, type ScreenshotGate } from "./screenshot/gates.js";
export { findStorageStateProblem } from "./screenshot/storage-state.js";
export { getScreenshotNames, getScreenshotShots, type ScreenshotNaming, type ScreenshotShot } from "./config/screenshot-names.js";
export {
  CLIP_FITS,
  CLIP_ROLES,
  CUT_TRANSITIONS,
  DEFAULT_CUT,
  DEFAULT_FILLERS,
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_TRANSITIONS,
  getDefaultFillers,
  type ClipFit,
  type ClipRole,
  type CutOptions,
  type CutTransition,
  type FootageClip,
  type FootageFilm,
  type FootageMusic,
  type FootageTransitions,
  type MusicSource,
} from "./footage/film.js";
export {
  MIN_CLIP_SECONDS,
  describeProbe,
  findFootageProblems,
  getTrimmedDuration,
  normalizeRotation,
  probeFile,
  probeFootage,
  readFootageProbe,
  type FootageProbe,
  type HdrKind,
  type ProbeResult,
  type ProbedClip,
} from "./footage/probe.js";
export { FOOTAGE_FPS, FOOTAGE_SAMPLE_RATE, buildNormalizeArgs, buildVideoFilter, normalizeFootage, resolveFit, toneMapFilter, type Frame, type NormalizeInput } from "./footage/normalize.js";
export {
  describePaidSteps,
  toPaidAudio,
  type FootageCharge,
  type FootageProgress,
  type FootageProviders,
  type FootageRates,
  type FootageStage,
  type IsolationProvider,
  type MusicProvider,
  type PaidAudio,
  type PaidStep,
  type PaidStepKind,
  type SttInput,
  type SttProvider,
  type SttTranscript,
} from "./footage/providers.js";
export {
  ELEVENLABS_MUSIC_MODEL,
  ELEVENLABS_STT_MODEL,
  createElevenLabsFootageProviders,
  createElevenLabsIsolationProvider,
  createElevenLabsMusicProvider,
  createElevenLabsSttProvider,
  getMusicLengthMs,
  readReportedCredits,
  readScribeResponse,
  type ElevenLabsFootageOptions,
} from "./footage/elevenlabs.js";
export {
  createFakeIsolationProvider,
  createFakeMusicProvider,
  createFakeSttProvider,
  makePlaceholderTranscript,
  type FakeIsolationProvider,
  type FakeMusicProvider,
  type FakeSttOptions,
  type FakeSttProvider,
} from "./footage/fake.js";
export { footageCacheKey, getFootageCachePath, hashFile, readCachedTranscript, type FootageCacheKind } from "./footage/cache.js";
export {
  MIN_SEGMENT_SECONDS,
  SEGMENT_MOTIONS,
  buildEdl,
  edlSchema,
  findEdlProblems,
  getEdlDuration,
  getSegmentStarts,
  isFiller,
  normalizeWord,
  readEdl,
  remapWords,
  type Edl,
  type EdlClip,
  type EdlSegment,
  type SegmentMotion,
} from "./footage/edl.js";
export { duckingKeyframes, getSpeechSpans, volumeExpression, type DuckingOptions, type VolumeKeyframe } from "./footage/music.js";
export { END_CARD_SECONDS, FADE_SECONDS, composeFootage, getFootageFilmSeconds, getSegmentScales, type FootageComposeAssets, type FootageComposeInput } from "./footage/compose.js";
export { buildCutPreviewArgs, buildLastFrameArgs, buildMusicArgs, buildSpeechArgs } from "./footage/render.js";
export {
  DEFAULT_LOUDNESS,
  buildLoudnessArgs,
  buildLoudnessMeasureArgs,
  isSilent,
  normalizeLoudness,
  readLoudnessMeasurement,
  type LoudnessMeasurement,
  type LoudnessOutcome,
  type LoudnessTarget,
} from "./footage/loudness.js";
export {
  buildCoverArgs,
  buildFinishArgs,
  clampCoverSeconds,
  findFinishProblems,
  getCoverPath,
  getDefaultCoverSeconds,
  isFastStart,
  isPublishableAudio,
  isPublishableVideo,
  probeFilmFacts,
  readFilmFacts,
  readTopLevelBoxes,
  type FilmFacts,
} from "./footage/publish.js";
export { readFfmpegProgressSeconds, runFfmpeg, runProcess, type FfmpegRunOptions, type ProcessOptions, type ProcessOutcome } from "./footage/process.js";
export {
  estimateFootageFilm,
  findCachedStep,
  getDownloadPath,
  type EstimateFootageOptions,
  type FootageCacheOptions,
  type FootageEstimate,
  type FootageEstimateItem,
} from "./footage/paid.js";
export { REQUIRED_DECODERS, REQUIRED_FILTERS, checkFootageTools, findBrowserProblem, readFfmpegListing, type FootageToolsOptions } from "./footage/tools.js";
export {
  cutFootage,
  getEdlPath,
  getFrame,
  prepareFootage,
  readEdlFile,
  readRenderPercent,
  renderFootage,
  renderFootageFilm,
  transcribeFootage,
  type FinishedFootage,
  type FootageBrand,
  type FootageResult,
  type FootageRunOptions,
  type PreparedClip,
  type RenderFootageFilmOptions,
  type RenderFootageOptions,
  type RenderedFootage,
  type TranscribeOutcome,
} from "./footage/pipeline.js";
export {
  formatMessage,
  getMarketingMessages,
  marketingMessages,
  type MarketingMessageOverrides,
  type MarketingMessages,
} from "./messages/index.js";
