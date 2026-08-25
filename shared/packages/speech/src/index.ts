type VoiceModule = { start?: (locale: string, options?: Record<string, unknown>) => Promise<unknown>; stop?: () => Promise<unknown> };
let active = false;
const getVoice = (): VoiceModule | null => { try { return require("@react-native-voice/voice") as VoiceModule; } catch { return null; } };
export const startSpeech = async (locale = "en-US", options: Record<string, unknown> = {}): Promise<boolean> => { const voice = getVoice(); if (!voice?.start) return false; await voice.start(locale, options); active = true; return true; };
export const stopSpeech = async (): Promise<boolean> => { const voice = getVoice(); if (!voice) return false; if (voice.stop) await voice.stop(); active = false; return true; };
export const isSpeechActive = (): boolean => active;
export default { startSpeech, stopSpeech, isSpeechActive };
