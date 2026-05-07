import type { SettingsKey } from "@/ui/global/settings.global";

type Option = { id: string; label: string; key: SettingsKey };

export const SETTINGS_OPTIONS: Option[] = [
  { id: "1", label: "Sound", key: "beep" },
  { id: "2", label: "Style", key: "style" },
] as const;
