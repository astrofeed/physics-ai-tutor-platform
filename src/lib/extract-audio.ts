/**
 * Browser-side audio extraction: turns a presentation video file into a
 * 16 kHz mono WAV suitable for speech-to-text, so the (large) video itself
 * never leaves the TA's machine.
 *
 * Web Audio decodes MP4/MOV/WebM natively. Containers the browser cannot
 * decode (WMV/ASF, AVI, MKV, FLV…) fall back to ffmpeg.wasm, whose ~30 MB
 * single-threaded core is fetched from unpkg on first use.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const TARGET_SAMPLE_RATE = 16_000;

const FFMPEG_CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
const FFMPEG_TRANSCODE_TIMEOUT_MS = 5 * 60 * 1000;

export class AudioExtractionError extends Error {}

export type AudioExtractionPhase = "extracting" | "transcoding";

export interface ExtractedAudio {
  wav: Blob;
  durationSeconds: number;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function decodeWithWebAudio(bytes: ArrayBuffer): Promise<AudioBuffer | null> {
  const context = new AudioContext();
  try {
    return await context.decodeAudioData(bytes);
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

let ffmpegInstance: Promise<FFmpeg> | null = null;

function loadFfmpeg(): Promise<FFmpeg> {
  ffmpegInstance ??= (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })().catch((error) => {
    ffmpegInstance = null;
    throw error;
  });
  return ffmpegInstance;
}

function inputExtension(file: File): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(file.name);
  return match ? match[1].toLowerCase() : "bin";
}

/** Demuxes and resamples the audio track with ffmpeg.wasm into 16 kHz mono PCM WAV. */
async function transcodeWithFfmpeg(file: File): Promise<ArrayBuffer> {
  const ffmpeg = await loadFfmpeg();
  const input = `input.${inputExtension(file)}`;
  const output = "output.wav";

  await ffmpeg.writeFile(input, await fetchFile(file));
  try {
    const exitCode = await ffmpeg.exec(
      ["-i", input, "-vn", "-ac", "1", "-ar", String(TARGET_SAMPLE_RATE), "-c:a", "pcm_s16le", "-f", "wav", output],
      FFMPEG_TRANSCODE_TIMEOUT_MS
    );
    if (exitCode !== 0) {
      throw new AudioExtractionError(
        "Could not read the audio track of this video. Please check that the file plays and has sound, or convert it to MP4 first."
      );
    }
    const data = await ffmpeg.readFile(output);
    if (typeof data === "string") throw new AudioExtractionError("ffmpeg returned text instead of audio data");
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } finally {
    await Promise.allSettled([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)]);
  }
}

async function resampleToMonoWav(decoded: AudioBuffer): Promise<Blob> {
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(decoded.duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE);
}

/**
 * Decodes the video's audio track and re-encodes it as 16 kHz mono WAV.
 * `onPhase` fires with "transcoding" when the browser cannot decode the
 * container and ffmpeg.wasm takes over (slower; first use downloads the core).
 */
export async function extractAudioFromVideo(
  file: File,
  onPhase?: (phase: AudioExtractionPhase) => void
): Promise<ExtractedAudio> {
  onPhase?.("extracting");
  let decoded = await decodeWithWebAudio(await file.arrayBuffer());

  if (!decoded) {
    onPhase?.("transcoding");
    let wavBytes: ArrayBuffer;
    try {
      wavBytes = await transcodeWithFfmpeg(file);
    } catch (error) {
      if (error instanceof AudioExtractionError) throw error;
      console.error("ffmpeg.wasm transcode failed:", error);
      throw new AudioExtractionError(
        "Could not convert this video in the browser. Please convert it to MP4 and try again."
      );
    }
    decoded = await decodeWithWebAudio(wavBytes);
    if (!decoded) {
      throw new AudioExtractionError(
        "Could not read the audio track of this video. Please convert it to MP4 and try again."
      );
    }
  }

  return {
    wav: await resampleToMonoWav(decoded),
    durationSeconds: decoded.duration,
  };
}
