/**
 * 通用时间格式化工具
 */

import i18n from "../i18n";

export type TimeInput = string | number | Date | null | undefined;

/**
 * 判断输入是否为有效时间
 */
export const isValidTime = (value: TimeInput): boolean => {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
};

/**
 * 将输入转换为 Date，无效则返回 null
 */
export const toDate = (value: TimeInput): Date | null => {
  if (!isValidTime(value)) {
    return null;
  }
  return value instanceof Date ? value : new Date(value as string | number);
};

const pad = (n: number): string => String(n).padStart(2, "0");

const isZhLocale = (locale?: string): boolean => {
  const normalized = (locale || i18n.resolvedLanguage || i18n.language || "zh").toLowerCase();
  return normalized.startsWith("zh");
};

/**
 * 格式化时间为本地时间字符串
 * @param value 时间值（string/number/Date）
 * @param fallback 无效值时返回的占位符，默认 "-"
 */
export const formatTime = (value: TimeInput, fallback: string = "-"): string => {
  const date = toDate(value);
  if (!date) {
    return fallback;
  }
  return date.toLocaleString();
};

/**
 * 格式化为 YYYY-MM-DD HH:mm:ss
 */
export const formatDateTime = (value: TimeInput, fallback: string = "-"): string => {
  const date = toDate(value);
  if (!date) {
    return fallback;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * 格式化为 YYYY-MM-DD
 */
export const formatDate = (value: TimeInput, fallback: string = "-"): string => {
  const date = toDate(value);
  if (!date) {
    return fallback;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * 格式化为相对时间（如 "3 分钟前"）
 */
export const formatRelativeTime = (value: TimeInput,  locale: string,fallback: string = "-"): string => {
  const date = toDate(value);
  if (!date) {
    return fallback;
  }

  const zh = isZhLocale(locale);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return zh ? "刚刚" : "just now";
  }
  if (diff < hour) {
    return zh ? `${Math.floor(diff / minute)} 分钟前` : `${Math.floor(diff / minute)} minutes ago`;
  }
  if (diff < day) {
    return zh ? `${Math.floor(diff / hour)} 小时前` : `${Math.floor(diff / hour)} hours ago`;
  }
  if (diff < 30 * day) {
    return zh ? `${Math.floor(diff / day)} 天前` : `${Math.floor(diff / day)} days ago`;
  }
  return formatDate(value, fallback);
};
