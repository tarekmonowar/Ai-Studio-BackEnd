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
