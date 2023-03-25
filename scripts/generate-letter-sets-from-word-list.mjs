// Script to take a raw txt file with a list of words and generate a json file
// with only the words that are viable for the spelling bee game
// (longer than 4 chars, only has at most 6 unique chars).
// TODO: extend this to accept args for different languages

const wordFilePath = process.argv[2];

if (!wordFilePath) {
  throw new Error("Please provide a file path to the word list txt file");
}

const fs = await import("node:fs/promises");

const fileContents = await fs.readFile(wordFilePath, "utf-8");

const allWords = fileContents.split(/\s/);

console.log(`Read in ${allWords.length} words from ${wordFilePath}`);

const getUniqueCharacterCount = (word) => {
  const uniqueChars = new Set();
  for (let i = 0, charCount = word.length; i < charCount; ++i) {
    uniqueChars.add(word[i]);
  }
  return uniqueChars.size;
};

const startTime = performance.now();

const spellingBeeViableWords = allWords.filter(
  (word) => word.length >= 4 && getUniqueCharacterCount(word) <= 7
);

const letterSets = new Map();

for (let i = 0, wordCount = spellingBeeViableWords.length; i < wordCount; ++i) {
  const charSet = [];
  const word = spellingBeeViableWords[i];

  for (let j = 0, charCount = word.length; j < charCount; ++j) {
    const char = word[j];
    if (!charSet.includes(char)) {
      charSet.push(char);
    }
  }

  if (charSet.length < 7) continue;

  const wordLetterSet = charSet.sort().join("");
  if (!letterSets.has(wordLetterSet)) {
    letterSets.set(wordLetterSet, [word]);
  } else {
    letterSets.set(wordLetterSet, letterSets.get(wordLetterSet).concat([word]));
  }
}

const usableLetterSets = [];

function processLetterSet(letterSet, availableWords) {
  // Construct an array of all 7 possible variants of the letter set (where each different character is the center letter)
  // We'll then go through these variants and validate if they'll produce a good set of words or not
  // Each variant is an array w/ 3 elements:
  // 1. The center letter
  // 2. The outer letters
  // 3. The list of words that can be made with this set
  const letterSetVariants = [];

  const variantCandidates = [];

  const CENTER_LETTER_INDEX = 0;
  const OUTER_LETTER_INDEX = 1;
  const VALID_WORD_LIST_INDEX = 2;
  const TOTAL_POSSIBLE_SCORE_INDEX = 3;
  const REGEX_INDEX = 4;

  for (let i = 0, charCount = letterSet.length; i < charCount; ++i) {
    const centerLetter = letterSet[i];
    const outerLetters = letterSet.slice(0, i).concat(letterSet.slice(i + 1));
    const candidate = [];
    candidate[CENTER_LETTER_INDEX] = centerLetter;
    candidate[OUTER_LETTER_INDEX] = outerLetters;
    candidate[VALID_WORD_LIST_INDEX] = [];
    candidate[TOTAL_POSSIBLE_SCORE_INDEX] = 0;
    candidate[REGEX_INDEX] = new RegExp(
      `^[${outerLetters}]*${centerLetter}+[${outerLetters}]*$`
    );

    variantCandidates.push(candidate);
  }

  for (let j = 0, wordCount = availableWords.length; j < wordCount; ++j) {
    const word = availableWords[j];

    const wordCharacterSet = new Set();

    for (let k = 0, wordCharCount = word.length; k < wordCharCount; ++k) {
      wordCharacterSet.add(word[k]);
    }

    const isPanagram = wordCharacterSet.size >= 7;

    for (let i = 0, varCount = variantCandidates.length; i < varCount; ++i) {
      const candidate = variantCandidates[i];

      const isValidWord = candidate[REGEX_INDEX].test(word);

      if (isValidWord) {
        candidate[VALID_WORD_LIST_INDEX].push(word);
        candidate[TOTAL_POSSIBLE_SCORE_INDEX] +=
          (word.length <= 4 ? 1 : word.length) + (isPanagram ? 7 : 0);

        if (candidate[TOTAL_POSSIBLE_SCORE_INDEX] > 250) {
          // This variant has too many words to the point where it will be overwhelming to play,
          // so we're going to drop it, let's break out of the word loop!
          break;
        }
      }
    }
  }

  for (let i = 0, varCount = variantCandidates.length; i < varCount; ++i) {
    const candidate = variantCandidates[i];
    const totalPossibleScore = candidate[TOTAL_POSSIBLE_SCORE_INDEX];
    if (totalPossibleScore >= 50 && totalPossibleScore <= 250) {
      const centerLetter = candidate[CENTER_LETTER_INDEX];
      const outerLetters = candidate[OUTER_LETTER_INDEX];
      const validWords = candidate[VALID_WORD_LIST_INDEX];

      letterSetVariants.push([centerLetter, outerLetters, validWords]);
    }
  }

  return letterSetVariants;
}

function extractLetterSetsFromWord(word) {
  if (word.length < 4) return [];

  const CENTER_LETTER_INDEX = 0;
  const OUTER_LETTERS_INDEX = 1;
  const letterSets = [];

  const uniqueCharMap = {};
  const uniqueChars = [];

  for (let i = 0, charCount = word.length; i < charCount; ++i) {
    const char = word[i];

    if (!uniqueCharMap[char]) {
      uniqueCharMap[char] = true;
      uniqueChars.push(char);
    }
  }

  if (uniqueChars.length > 7) return [];

  // Make sure the characters are sorted alphabetically
  // so that we can easily compare letter sets
  uniqueChars.sort();

  for (let i = 0, letterCount = uniqueChars.length; i < letterCount; ++i) {
    const centerLetter = uniqueChars[i];
    const outerLetters = uniqueChars
      .slice(0, i)
      .concat(uniqueChars.slice(i + 1));

    const letterSet = new Array(2);
    letterSet[CENTER_LETTER_INDEX] = centerLetter;
    letterSet[OUTER_LETTERS_INDEX] = outerLetters;

    letterSets.push(letterSet);
  }

  return letterSets;
}

const workerpool = await import("workerpool");
const pool = workerpool.pool();

const letterSetProcessingPromises = [];

for (const [letterSet, panagramWords] of letterSets.entries()) {
  // We only want letter sets with 1-2 panagrams; any more stops feeling special
  if (panagramWords.length < 3) {
    letterSetProcessingPromises.push(
      pool
        .exec(processLetterSet, [letterSet, spellingBeeViableWords])
        .then((letterSetVariants) => {
          usableLetterSets.push(...letterSetVariants);
        })
    );
  }
}

await Promise.all(letterSetProcessingPromises);

pool.terminate();

const finalWordList = [];
const wordListIndexMap = new Map();

const consolidatedLetterSetIndexMap = new Map();
const finalConsolidatedLetterSets = [];

for (
  let i = 0, letterSetCount = usableLetterSets.length;
  i < letterSetCount;
  ++i
) {
  const letterSet = usableLetterSets[i];
  const centerLetter = letterSet[0];
  const outerLetters = letterSet[1];
  const letterSetWords = letterSet[2];

  for (let j = 0, wordCount = letterSetWords.length; j < wordCount; ++j) {
    const word = letterSetWords[j];

    if (wordListIndexMap.has(word)) {
      letterSetWords[j] = wordListIndexMap.get(word);
    } else {
      const wordIndex = finalWordList.length;
      finalWordList.push(word);
      wordListIndexMap.set(word, wordIndex);
      letterSetWords[j] = wordIndex;
    }
  }

  // Convert the center letter to a 0-based index from 0-25
  // because this allows us to keep our json file a little smaller
  const centerLetterCharIndex = centerLetter.charCodeAt(0) - 97;

  if (consolidatedLetterSetIndexMap.has(centerLetterCharIndex)) {
    const consolidatedLetterSetIndex = consolidatedLetterSetIndexMap.get(
      centerLetterCharIndex
    );
    finalConsolidatedLetterSets[consolidatedLetterSetIndex][1].push([
      outerLetters,
      letterSetWords,
    ]);
  } else {
    const letterSetIndex = finalConsolidatedLetterSets.length;
    finalConsolidatedLetterSets.push([
      centerLetterCharIndex,
      [[outerLetters, letterSetWords]],
    ]);
    consolidatedLetterSetIndexMap.set(centerLetterCharIndex, letterSetIndex);
  }
}

await fs.writeFile(
  "src/words/en.json",
  JSON.stringify([finalWordList, finalConsolidatedLetterSets]),
  "utf-8"
);

const endTime = performance.now();
const totalTime = (endTime - startTime) / 1000;

console.log(
  `Generated list of ${usableLetterSets.length} sets at src/words/en-v2.json in ${totalTime} seconds`
);
