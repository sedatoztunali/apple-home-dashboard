import * as en from '../translations/en.json';
import * as de from '../translations/de.json';
import * as es from '../translations/es.json';
import * as fr from '../translations/fr.json';
import * as it from '../translations/it.json';
import * as nl from '../translations/nl.json';
import * as tr from '../translations/tr.json';
import * as pt from '../translations/pt.json';
import * as ru from '../translations/ru.json';
import * as zh from '../translations/zh.json';
import * as he from '../translations/he.json';
import { RTLHelper } from './RTLHelper';

/** Registry of currently supported languages */
const languages: Record<string, any> = {
  en,
  de,
  es,
  fr,
  it,
  nl,
  tr,
  pt,
  ru,
  zh,
  he,
};

/** The fallback language if the user-defined language isn't defined */
const DEFAULT_LANG = 'en';

/**
 * Get a string by keyword and language.
 *
 * @param {string} key The key to look for in the object notation of the language file (E.g., `status.on`).
 * @param {string} lang The language to get the string from (E.g., `en`).
 *
 * @returns {string | undefined} The requested string or undefined if the keyword doesn't exist/on error.
 */
function getTranslatedString(key: string, lang: string): string | undefined {
  try {
    return key.split('.').reduce((o, i) => (o as Record<string, unknown>)[i], languages[lang]) as string;
  } catch {
    return undefined;
  }
}

/**
 * Singleton instance of the localization function.
 *
 * This variable is set by {@link setupLocalize} and used by {@link localize}.
 *
 * - Must be initialized before {@link localize} is called.
 * - Holds a closure that translates keys based on the language set during setup.
 *
 * @private
 */
let _localize: ((key: string) => string) | undefined = undefined;

/**
 * Set up the localization.
 *
 * It reads the user-defined language with a fall-back to English and returns a function to get strings from
 * language-files by keyword.
 *
 * If the keyword is undefined, or on an error, the keyword itself is returned.
 *
 * @param {any} hass The Home Assistant object.
 */
export function setupLocalize(hass?: any): void {
  // Get language from Home Assistant or browser
  let lang = DEFAULT_LANG;
  
  if (hass?.locale?.language) {
    lang = hass.locale.language;
  } else if (hass?.language) {
    lang = hass.language;
  } else if (navigator.language) {
    lang = navigator.language.split('-')[0]; // Get base language code (e.g., 'en' from 'en-US')
  }

  // Ensure the language is supported, fallback to English
  if (!languages[lang]) {
    lang = DEFAULT_LANG;
  }

  _localize = (key: string) => getTranslatedString(key, lang) ?? getTranslatedString(key, DEFAULT_LANG) ?? key;
}

/**
 * Translate a key using the globally configured localize function.
 */
export function localize(key: string): string {
  if (!_localize) {
    console.warn('localize is not initialized! Call setupLocalize first.');
    return key;
  }
  return _localize(key);
}
