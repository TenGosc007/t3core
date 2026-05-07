import { getSettings } from "@/ui/global/settings.global";

type Colors =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "black"
  | "default"
  | "grey"
  | "lightRed"
  | "lightGreen"
  | "lightYellow"
  | "lightBlue"
  | "lightMagenta"
  | "lightCyan"
  | "lightWhite";

const colorCodes = new Map<Colors, number>([
  ["default", 0],
  ["black", 30],
  ["red", 31],
  ["green", 32],
  ["yellow", 33],
  ["blue", 34],
  ["magenta", 35],
  ["cyan", 36],
  ["white", 37],
  ["grey", 90],
  ["lightRed", 91],
  ["lightGreen", 92],
  ["lightYellow", 93],
  ["lightBlue", 94],
  ["lightMagenta", 95],
  ["lightCyan", 96],
  ["lightWhite", 97],
]);

const backgroundColorCodes = new Map<Colors, number>([
  ["default", 0],
  ["grey", 40],
  ["red", 41],
  ["green", 42],
  ["yellow", 43],
  ["blue", 44],
  ["magenta", 45],
  ["cyan", 46],
  ["white", 47],
  ["grey", 100],
  ["lightRed", 101],
  ["lightGreen", 102],
  ["lightYellow", 103],
  ["lightBlue", 104],
  ["lightMagenta", 105],
  ["lightCyan", 106],
  ["lightWhite", 107],
]);

type TextStyles =
  | "default"
  | "bold"
  | "dim"
  | "italic"
  | "underline"
  | "inverse"
  | "hidden"
  | "strikethrough";

const textStyleCodes = new Map<TextStyles, number>([
  ["default", 0],
  ["bold", 1],
  ["dim", 2],
  ["italic", 3],
  ["underline", 4],
  ["inverse", 7],
  ["hidden", 8],
  ["strikethrough", 9],
]);

type StyledLabelOptions = {
  color?: Colors;
  backgroundColor?: Colors;
  textStyle?: TextStyles;
};

export const styledLabel = (
  label: string | number,
  options?: StyledLabelOptions,
) => {
  if (!getSettings().style) {
    return label.toString();
  }

  const colorCode = colorCodes.get(options?.color ?? "default");
  const backgroundColorCode = backgroundColorCodes.get(
    options?.backgroundColor ?? "default",
  );
  const textStyleCode = textStyleCodes.get(options?.textStyle ?? "default");

  const styles = [];

  if (colorCode) {
    styles.push(colorCode);
  }
  if (backgroundColorCode) {
    styles.push(backgroundColorCode);
  }
  if (textStyleCode) {
    styles.push(textStyleCode);
  }

  if (styles.length === 0) {
    return label.toString();
  }

  return `\x1b[${styles.join(";")}m${label}\x1b[0m`;
};
