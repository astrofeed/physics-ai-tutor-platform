/**
 * Browser-side audio extraction: turns a presentation video file into a
 * 16 kHz mono WAV suitable for speech-to-text, so the (large) video itself
 * never leaves the TA's machine.
 */

const TARGET_SAMPLE_RATE = 16_000;

export class AudioExtractionError extends Error {}

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

export interface ExtractedAudio {
  wav: Blob;
  durationSeconds: number;
}

/** Decodes the video's audio track and re-encodes it as 16 kHz mono WAV. */
export async function extractAudioFromVideo(file: File): Promise<ExtractedAudio> {
  const bytes = await file.arrayBuffer();

  const decodeContext = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(bytes);
  } catch {
    throw new AudioExtractionError(
      "Could not read the audio track of this video. Please use MP4/MOV/WebM, or convert the file first."
    );
  } finally {
    await decodeContext.close();
  }

  const durationSeconds = decoded.duration;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(durationSeconds * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return {
    wav: encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE),
    durationSeconds,
  };
}
