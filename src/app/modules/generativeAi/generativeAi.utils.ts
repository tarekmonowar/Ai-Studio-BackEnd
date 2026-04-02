import type { SpeakerProfile } from "../../config/env.js";

const MONOWAR_VOICE = "en-US-Andrew:DragonHDLatestNeural";
const MUNTAHA_VOICE = "en-US-Ava:DragonHDLatestNeural";

export function resolveVoiceByProfile(profile?: SpeakerProfile): string {
  if (profile === "monowar") {
    return MONOWAR_VOICE;
  }

  return MUNTAHA_VOICE;
}

export function resolveVoiceConfig(voiceName: string) {
  const isAzureVoice = voiceName.includes("-") || voiceName.includes(":");

  if (isAzureVoice) {
    return {
      type: "azure-standard",
      name: voiceName,
    };
  }

  return {
    type: "openai",
    name: voiceName,
  };
}
