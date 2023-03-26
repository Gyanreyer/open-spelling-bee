// Script to take a raw txt file with a list of words and generate a json file
// with only the words that are viable for the spelling bee game
// (longer than 4 chars, only has at most 6 unique chars).
// TODO: extend this to accept args for different languages

/**
 * @example
 * node generate-word-data.mjs --lang en
 */

const langFlagIndex = process.argv.indexOf("--lang");
// Default to en if a language isn't specified
const lang = langFlagIndex > -1 ? process.argv[langFlagIndex + 1] : "en";

const wordFilePath = new URL(`../word-lists/${lang}.txt`, import.meta.url);

const fs = await import("node:fs/promises");

const fileContents = await fs.readFile(wordFilePath, "utf-8");

const allWords = fileContents.split(/\s/);

console.log(`Read in ${allWords.length} words from ${wordFilePath}`);

const letterSets = new Set();
// Maps words to their unique letter sets
const viableWords = new Map();

const startTime = performance.now();

for (
  let wordIndex = 0, wordCount = allWords.length;
  wordIndex < wordCount;
  ++wordIndex
) {
  const word = allWords[wordIndex];

  if (word.length < 4) {
    // All words must be at least 4 characters long
    continue;
  }

  const uniqueCharSet = new Set();

  for (let i = 0, charCount = word.length; i < charCount; ++i) {
    uniqueCharSet.add(word[i]);
  }

  const uniqueCharCount = uniqueCharSet.size;

  if (uniqueCharCount > 7) {
    // If the word has more than 7 unique characters, it can't be used in the game
    continue;
  }

  viableWords.set(word, uniqueCharSet);

  const isPanagram = uniqueCharCount === 7;

  if (isPanagram) {
    letterSets.add(Array.from(uniqueCharSet).sort().join(""));
  }
}

const finalLetterSetList = [];
for (const letterSetString of letterSets) {
  const letterSetArray = new Array(8);
  letterSetArray[0] = letterSetString;
  for (let i = 1; i < 8; ++i) {
    letterSetArray[i] = [];
  }
  finalLetterSetList.push(letterSetArray);
}

const finalWordList = [];
const wordIndexMap = new Map();

for (
  let letterSetIndex = 0, letterSetCount = finalLetterSetList.length;
  letterSetIndex < letterSetCount;
  ++letterSetIndex
) {
  const letterSet = finalLetterSetList[letterSetIndex];
  const letterSetString = letterSet[0];

  const regex = new RegExp(`^[${letterSetString}]*$`);

  for (const [word, uniqueCharSet] of viableWords) {
    if (regex.test(word)) {
      if (!wordIndexMap.has(word)) {
        wordIndexMap.set(word, finalWordList.length);
        finalWordList.push(word);
      }
      const wordIndex = wordIndexMap.get(word);

      for (let i = 0; i < 7; ++i) {
        const char = letterSetString[i];
        if (uniqueCharSet.has(char)) {
          letterSet[i + 1].push(wordIndex);
        }
      }
    }
  }

  for (let i = 1; i < 8; ++i) {
    // If there are more than 75 words for a given letter set variant,
    // remove it; this is too many words for anyone to enjoy finding them all,
    // and it also significantly inflates the file size
    const variantWordCount = letterSet[i]?.length ?? 0;
    if (variantWordCount < 10 || variantWordCount > 75) {
      letterSet[i] = 0;
    }
  }

  let hasVariantWithWords = false;

  for (let i = 1; i < 8; ++i) {
    const variantWordCount = finalLetterSetList[i]?.length ?? 0;
    if (variantWordCount > 0) {
      hasVariantWithWords = true;
      break;
    }
  }

  if (!hasVariantWithWords) {
    // If there are no words for a given letter set, remove it
    finalLetterSetList.splice(letterSetIndex, 1);
    --letterSetIndex;
    --letterSetCount;
  }
}

await fs.writeFile(
  new URL(`../src/words/${lang}.json`, import.meta.url),
  JSON.stringify([finalWordList, finalLetterSetList]),
  "utf-8"
);

const totalTime = performance.now() - startTime;

console.log("Processed word data in", totalTime, "ms");
