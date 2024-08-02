const { none } = require("./transformers");

const NON_ENGLISH_CHARS = (
    "\u3040-\u30ff" + // Japanese characters
    "\u3400-\u4dbf" + // Chinese characters
    "\u4e00-\u9fff" + // Chinese characters
    "\uf900-\ufaff" + // CJK Compatibility Ideographs
    "\uff66-\uff9f" + // Halfwidth Katakana Japanese characters
    "\u0400-\u04ff" + // Cyrillic characters (Russian)
    "\u0600-\u06ff" + // Arabic characters
    "\u0750-\u077f" + // Arabic characters
    "\u0c80-\u0cff" + // Kannada characters
    "\u0d00-\u0d7f" + // Malayalam characters
    "\u0e00-\u0e7f"   // Thai characters
  );
  
  const CURLY_BRACKETS = ["{", "}"];
  const SQUARE_BRACKETS = ["[", "]"];
  const PARENTHESES = ["(", ")"];
  const BRACKETS = [CURLY_BRACKETS, SQUARE_BRACKETS, PARENTHESES];
  
  const RUSSIAN_CAST_REGEX = new RegExp("\\([^)]*[\\u0400-\\u04ff][^)]*\\)$|(?<=\\/.*)\\(.*\\)$", "u");
  const ALT_TITLES_REGEX = new RegExp(`[^/|(]*[${NON_ENGLISH_CHARS}][^/|]*[/|]|[/|][^/|(]*[${NON_ENGLISH_CHARS}][^/|]*`, "u");
  const NOT_ONLY_NON_ENGLISH_REGEX = new RegExp(`(?<=[a-zA-Z][^${NON_ENGLISH_CHARS}]+)[${NON_ENGLISH_CHARS}].*[${NON_ENGLISH_CHARS}]|[${NON_ENGLISH_CHARS}].*[${NON_ENGLISH_CHARS}](?=[^${NON_ENGLISH_CHARS}]+[a-zA-Z])`, "u");
  const NOT_ALLOWED_SYMBOLS_AT_START_AND_END = new RegExp(`^[^\\w${NON_ENGLISH_CHARS}#[\\u3010\\u2605]+|[ \\-:/\\\\\\[|\\{(#$&^]+$`, "u");
  const REMAINING_NOT_ALLOWED_SYMBOLS_AT_START_AND_END = new RegExp(`^[^\\w${NON_ENGLISH_CHARS}#]+|\\]$`, "u");
  const REDUNDANT_SYMBOLS_AT_END = new RegExp(`[ \\-:./\\\\]+$`, "u");
  const EMPTY_BRACKETS_REGEX = new RegExp("\\(\\s*\\)|\\[\\s*\\]|\\{\\s*\\}", "u");


function extendOptions(options) {
    options = options || {};

    const defaultOptions = {
        skipIfAlreadyFound: true, // whether to skip a matcher if another matcher from this group was already found
        skipFromTitle: false, // whether to exclude found match from the end result title
        skipIfFirst: false, // whether to skip this matcher if there are no other groups matched before it's matchIndex
        remove: false // whether to remove the found match from further matchers
    };

    if (typeof options.skipIfAlreadyFound === "undefined") {
        options.skipIfAlreadyFound = defaultOptions.skipIfAlreadyFound;
    }
    if (typeof options.skipFromTitle === "undefined") {
        options.skipFromTitle = defaultOptions.skipFromTitle;
    }
    if (typeof options.skipIfFirst === "undefined") {
        options.skipIfFirst = defaultOptions.skipIfFirst;
    }
    if (typeof options.remove === "undefined") {
        options.remove = defaultOptions.remove;
    }

    return options;
}

function createHandlerFromRegExp(name, regExp, transformer, options) {
    function handler({ title, result, matched }) {
        if (result[name] && options.skipIfAlreadyFound) {
            return null;
        }

        const match = title.match(regExp);
        const [rawMatch, cleanMatch] = match || [];

        if (rawMatch) {
            const transformed = transformer(cleanMatch || rawMatch, result[name]);
            const beforeTitleMatch = title.match(/^\[([^[\]]+)]/);
            const isBeforeTitle = beforeTitleMatch && beforeTitleMatch[1].includes(rawMatch);
            const otherMatches = Object.entries(matched).filter(e => e[0] !== name);
            const isSkipIfFirst = options.skipIfFirst && otherMatches.length &&
                otherMatches.every(e => match.index < e[1].matchIndex);

            if (transformed && !isSkipIfFirst) {
                matched[name] = matched[name] || { rawMatch, matchIndex: match.index };
                result[name] = options.value || transformed;
                return {
                    rawMatch,
                    matchIndex: match.index,
                    remove: options.remove,
                    skipFromTitle: isBeforeTitle || options.skipFromTitle
                };
            }
        }

        return null;
    }

    handler.handlerName = name;

    return handler;
}

function cleanTitle(rawTitle) {
    /**
     * Clean up a title string by removing unwanted characters and patterns.
     *
     * @param {string} rawTitle - The raw title string.
     * @return {string} - The cleaned title string.
     */
    let cleanedTitle = rawTitle;

    if (!cleanedTitle.includes(" ") && cleanedTitle.includes(".")) {
        cleanedTitle = cleanedTitle.replace(/\./g, " ");
    }

    cleanedTitle = cleanedTitle.replace(/_/g, " ");
    cleanedTitle = cleanedTitle.replace(/\[\(movie\)\]/gi, "");
    cleanedTitle = cleanedTitle.replace(NOT_ALLOWED_SYMBOLS_AT_START_AND_END, "");
    cleanedTitle = cleanedTitle.replace(RUSSIAN_CAST_REGEX, "");
    cleanedTitle = cleanedTitle.replace(/^\[[【★].*[\]】★][ .]?(.+)/, "$1");
    cleanedTitle = cleanedTitle.replace(/(.+)[ .]?[[【★].*[\]】★]$/, "$1");
    cleanedTitle = cleanedTitle.replace(ALT_TITLES_REGEX, "");
    cleanedTitle = cleanedTitle.replace(NOT_ONLY_NON_ENGLISH_REGEX, "");
    cleanedTitle = cleanedTitle.replace(REMAINING_NOT_ALLOWED_SYMBOLS_AT_START_AND_END, "");
    cleanedTitle = cleanedTitle.replace(EMPTY_BRACKETS_REGEX, "");

    // Remove brackets if only one is present
    for (let [openBracket, closeBracket] of BRACKETS) {
        if ((cleanedTitle.match(new RegExp(`\\${openBracket}`, "g")) || []).length !== (cleanedTitle.match(new RegExp(`\\${closeBracket}`, "g")) || []).length) {
            cleanedTitle = cleanedTitle.split(openBracket).join("").split(closeBracket).join("");
        }
    }

    if (!cleanedTitle.includes(" ") && cleanedTitle.includes(".")) {
        cleanedTitle = cleanedTitle.replace(/\./g, " ");
    }

    cleanedTitle = cleanedTitle.replace(REDUNDANT_SYMBOLS_AT_END, "");
    cleanedTitle = cleanedTitle.trim();
    return cleanedTitle;
}


class Parser {

    constructor() {
        this.handlers = [];
    }

    addHandler(handlerName, handler, transformer, options) {
        if (typeof handler === "undefined" && typeof handlerName === "function") {

            // If no name is provided and a function handler is directly given
            handler = handlerName;
            handler.handlerName = "unknown";

        } else if (typeof handlerName === "string" && handler instanceof RegExp) {

            // If the handler provided is a regular expression
            transformer = typeof transformer === "function" ? transformer : none;
            options = extendOptions(typeof transformer === "object" ? transformer : options);
            handler = createHandlerFromRegExp(handlerName, handler, transformer, options);

        } else if (typeof handler === "function") {

            // If the handler is a function
            handler.handlerName = handlerName;

        } else {

            // If the handler is neither a function nor a regular expression, throw an error
            throw new Error(`Handler for ${handlerName} should be a RegExp or a function. Got: ${typeof handler}`);

        }

        this.handlers.push(handler);
    }

    parse(title) {
        title = title.replace(/_+/g, " ");
        const result = {};
        const matched = {};
        let endOfTitle = title.length;

        for (const handler of this.handlers) {
            const matchResult = handler({ title, result, matched });
            if (matchResult && matchResult.remove) {
                title = title.slice(0, matchResult.matchIndex) + title.slice(matchResult.matchIndex + matchResult.rawMatch.length);
            }
            if (matchResult && !matchResult.skipFromTitle && matchResult.matchIndex && matchResult.matchIndex < endOfTitle) {
                endOfTitle = matchResult.matchIndex;
            }
            if (matchResult && matchResult.remove && matchResult.skipFromTitle && matchResult.matchIndex < endOfTitle) {

                // adjust title index in case part of it should be removed and skipped
                endOfTitle -= matchResult.rawMatch.length;
            }
        }

        result.title = cleanTitle(title.slice(0, endOfTitle));

        return result;
    }
}

exports.Parser = Parser;
