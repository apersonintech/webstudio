import { captureError } from "@webstudio-is/error-utils";
import { DEFAULT_FONT_FALLBACK, SYSTEM_FONTS } from "@webstudio-is/fonts";
import type { StyleValue } from "../schema";

export type TransformValue = (styleValue: StyleValue) => undefined | StyleValue;

const fallbackTransform: TransformValue = (styleValue) => {
  if (styleValue.type === "fontFamily") {
    const firstFontFamily = styleValue.value[0];

    const fontFamily = styleValue.value;
    const fallbacks = SYSTEM_FONTS.get(firstFontFamily) ?? [
      DEFAULT_FONT_FALLBACK,
    ];
    const value = Array.from(new Set([...fontFamily, ...fallbacks]));

    return {
      type: "fontFamily",
      value,
    };
  }
};

// Use JSON.stringify to escape double quotes and backslashes in strings as it automatically replaces " with \" and \ with \\.
const sanitizeCssUrl = (str: string) => JSON.stringify(str);

export const toValue = (
  styleValue: undefined | StyleValue,
  transformValue?: TransformValue
): string => {
  if (styleValue === undefined) {
    return "";
  }
  const transformedValue =
    transformValue?.(styleValue) ?? fallbackTransform(styleValue);
  const value = transformedValue ?? styleValue;
  if (value.type === "unit") {
    return value.value + (value.unit === "number" ? "" : value.unit);
  }
  if (value.type === "fontFamily") {
    const families = [];
    for (const family of value.value) {
      families.push(family.includes(" ") ? `"${family}"` : family);
    }
    return families.join(", ");
  }
  if (value.type === "var") {
    const fallbacks = [];
    for (const fallback of value.fallbacks) {
      fallbacks.push(toValue(fallback, transformValue));
    }
    const fallbacksString =
      fallbacks.length > 0 ? `, ${fallbacks.join(", ")}` : "";
    return `var(--${value.value}${fallbacksString})`;
  }

  if (value.type === "keyword") {
    return value.value;
  }

  if (value.type === "invalid") {
    return value.value;
  }

  if (value.type === "unset") {
    return value.value;
  }

  if (value.type === "rgb") {
    return `rgba(${value.r}, ${value.g}, ${value.b}, ${value.alpha})`;
  }

  if (value.type === "image") {
    if (value.hidden || value.value.type !== "url") {
      // We assume that property is background-image and use this to hide background layers
      // In the future we might want to have a more generic way to hide values
      // i.e. have knowledge about property-name, as none is property specific
      return "none";
    }

    // @todo image-set
    return `url(${sanitizeCssUrl(value.value.url)})`;
  }

  if (value.type === "unparsed") {
    if (value.hidden === true) {
      // We assume that property is background-image and use this to hide background layers
      // In the future we might want to have a more generic way to hide values
      // i.e. have knowledge about property-name, as none is property specific
      return "none";
    }

    return value.value;
  }

  if (value.type === "layers") {
    const valueString = value.value
      .filter((layer) => layer.hidden !== true)
      .map((layer) => toValue(layer, transformValue))
      .join(", ");
    return valueString === "" ? "none" : valueString;
  }

  if (value.type === "tuple") {
    // Properties ike translate and scale are handled as tuples directly.
    // When the layer is hidden, the value goes as none.
    if (value.hidden === true) {
      return "none";
    }

    return value.value
      .filter((value) => value.hidden !== true)
      .map((value) => toValue(value, transformValue))
      .join(" ");
  }

  if (value.type === "function") {
    // Right now, we are using function-value only for filter and backdrop-filter functions
    if (value.hidden === true) {
      return "";
    }

    return `${value.name}(${toValue(value.args, transformValue)})`;
  }

  // https://www.w3.org/TR/css-variables-1/#guaranteed-invalid
  if (value.type === "guaranteedInvalid") {
    return "";
  }

  return captureError(new Error("Unknown value type"), value);
};
