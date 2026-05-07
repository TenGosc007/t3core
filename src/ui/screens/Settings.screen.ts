import { Header } from "../components/Header";
import { SettingsEntry } from "../features/settings/components/SettingsEntry";
import { SettingsHeader } from "../features/settings/components/SettingsHeader";
import { SettingsOptions } from "../features/settings/components/SettingsOptions";
import { beepAndClear } from "../utils/beepAndClear";

export const SettingsScreen = () => {
  beepAndClear();
  Header();
  SettingsHeader();
  SettingsOptions();
  SettingsEntry();
};
