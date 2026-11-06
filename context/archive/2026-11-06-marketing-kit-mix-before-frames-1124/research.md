---
change_id: marketing-kit-mix-before-frames-1124
status: done
---

# Research: the footage mix stage on high-crest speech (issue #1124)

## The code today

- `finishFootage` (`pipeline.ts`) measures hyperframes' render, then `finishMix` encodes gain + 4x `alimiter` to AAC,
  measures, and retries up to `MIX_ATTEMPTS` (4) with `getNextMixAttempt`: the ceiling is lowered by the overshoot,
  the gain from a fitted limiter slope (#1095). Then the final pass muxes `mix.m4a` and the finished file is gated.
- The composition's sound is the speech track (`assets/speech.mp3`, to the cut's end), the ducked music
  (`assets/music.mp3`, to the film's end) and the sfx cues (`whoosh`, `pop`: start, linear volume, duration), all
  played by hyperframes from `data-start` 0. Clips are muted.

## Measurements (ffmpeg 6.1.1, fixtures from the issue and its comment)

Fixtures: the comment's lavfi render (band-passed pink noise syllables, 2 kHz high-passed clicks every 0.15 s, A =
0.6, 0.75, 1.0, 1.2) and the issue's flite speech with 6 ms clicks (a = 0.4, 0.8, 1.2), AAC 192k MP4.

1. **Loudness is not monotone in the gain.** render A = 0.75 at a -2 dBTP ceiling: gain 0 → -15.8 LUFS, +3 → -18.9,
   +6 → -19.2, +9 → -18.4 (uncompressed). The clicks carry the loudness and the limiter crushes them. A model with
   one slope cannot follow that; measuring the uncompressed chain can.
2. **The AAC overshoot is a property of the limiter's HF, not of the loudness.** Over 56 gain/ceiling pairs the
   encode's true peak over the uncompressed chain's: up to 3.4 dB (mean 1.6) as today; with a 16 kHz low-pass
   after the limiter, 1.4 dB (mean 0.4); with the low-pass and the encoder's `-cutoff 16000`, 1.2 dB (mean 0.05).
   A low-pass before the limiter does not help (the limiter's gain moves make the HF), and the post-limiter low-pass
   lets the uncompressed peak ring up to 0.56 dB over the ceiling.
3. **An uncompressed pass is cheap and exact.** Gain + limiter + low-pass measured with `loudnorm` into `-f null`
   costs one decode of the audio (no AAC, no file), and gives the loudness the encode will have within 0.1 to 0.3 LU.

## Simulation of the candidate stage (all 7 fixtures, keep speech, -14 ± 1, -1 dBTP)

Ceiling fixed at `truePeak - 1`; the gain solved on uncompressed passes (secant, step by the miss when the slope is
flat or falling, best point kept, at most 6 passes) to the window shrunk by 0.3 LU; encode; on a miss the ceiling is
lowered only by the measured true-peak excess plus 0.3 dB and the gain solved again at it, shifted by the codec's
measured loudness drift.

| chain | encodes per fixture | fail |
| --- | --- | --- |
| today's chain, solved gain, H = 1.5 | 1-2 (5 of 7 needed 2) | 0 |
| + low-pass 16 kHz + `-cutoff 16000`, H = 1.5 | 1-2 (1 of 7 needed 2) | 0 |
| + low-pass 16 kHz + `-cutoff 16000`, H = 1 | 1 (all 7) | 0 |

Today's loop on the same fixtures (issue): 3-4 encodes or a failure.

## Before the frames

The ffmpeg mix of speech, music and sfx cues (`atrim` to each element's duration, `volume`, `adelay`, `amix
normalize=0`, padded and trimmed to the film's length) is what hyperframes plays; it is built from the assets before
the render, so the mix stage can run and fail before any frame.
