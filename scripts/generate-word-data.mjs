// Script to take a raw txt file with a list of words and generate a json file
// with only the words that are viable for the spelling bee game
// (longer than 4 chars, only has at most 6 unique chars).

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

const wordTrie = {};

const letterSets = new Set();
const viableWords = [];

const startTime = performance.now();

// Filter down allWords to a set of only the words that are viable for the game,
// and also generate a set of all the possible letter sets based on any words which
// are panagrams (have exactly 7 unique characters)
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

  const charCount = word.length;
  for (let i = 0; i < charCount; ++i) {
    uniqueCharSet.add(word[i]);
  }
  const uniqueCharCount = uniqueCharSet.size;
  if (uniqueCharCount > 7) {
    // If the word has more than 7 unique characters, it can't be used in the game
    continue;
  }

  viableWords.push(word);

  const isPanagram = uniqueCharCount === 7;

  if (isPanagram) {
    letterSets.add(Array.from(uniqueCharSet).sort().join(""));
  }

  const sortedCharSet = Array.from(uniqueCharSet).sort();

  let wordTrieNode = wordTrie;
  for (const char of sortedCharSet) {
    if (!wordTrieNode[char]) {
      wordTrieNode[char] = {};
    }
    wordTrieNode = wordTrieNode[char];
  }
  wordTrieNode.words = wordTrieNode.words || [];
  wordTrieNode.words.push(word);
}

const finalLetterSetList = [];
const finalLetterSetVariantList = [];
const finalWordList = [];
const wordIndexMap = new Map();

const workerpool = await import("workerpool");

const pool = workerpool.pool(
  "./scripts/process-letter-set-worker.mjs"
  // new URL("./process-letter-set-worker.mjs", import.meta.url)
);

const processLetterSetPromises = [];

const unprocessedLetterSets = Array.from(letterSets);

// Number of letter sets that we should process at a time
// per worker (doing one at a time is barely faster than
// doing them all at once due to the added overhead of
// spawning a new worker and communicating with it)
const LETTER_SET_CHUNK_SIZE = Math.ceil(
  unprocessedLetterSets.length / pool.maxWorkers
);

while (unprocessedLetterSets.length > 0) {
  const letterSetChunk = unprocessedLetterSets.splice(0, LETTER_SET_CHUNK_SIZE);
  processLetterSetPromises.push(
    pool
      .exec("processLetterSet", [letterSetChunk, wordTrie])
      .then((processedLetterSetArrayChunk) => {
        for (const processedLetterSetArray of processedLetterSetArrayChunk) {
          const [letterSetString, ...wordLists] = processedLetterSetArray;

          let letterSetStringIndex = null;

          for (
            let i = 0, wordListCount = wordLists.length;
            i < wordListCount;
            ++i
          ) {
            const wordList = wordLists[i];

            const wordCount = wordList.length;
            if (wordCount < 10 || wordCount > 60) {
              // Skip letter sets that have less than 10 words or more than 60 words
              continue;
            }

            for (let j = 0; j < wordCount; ++j) {
              // Replace the word strings with their index in the finalWordList
              // for space efficiency in the final json file
              const word = wordList[j];
              if (!wordIndexMap.has(word)) {
                wordIndexMap.set(word, finalWordList.length);
                finalWordList.push(word);
              }
              const wordIndex = wordIndexMap.get(word);
              wordList[j] = wordIndex;
            }

            if (letterSetStringIndex === null) {
              letterSetStringIndex = finalLetterSetList.length;
              finalLetterSetList.push(letterSetString);
            }

            finalLetterSetVariantList.push([
              [letterSetStringIndex, i],
              wordList,
            ]);
          }
        }
      })
  );
}

await Promise.all(processLetterSetPromises);

pool.terminate();

const uncompressedFileContents = JSON.stringify([
  finalWordList,
  finalLetterSetList,
  finalLetterSetVariantList,
]);

// We're going to compress the file using brotli
// to help reduce the size of the file which will
// end up living in the user's cache
// This is a little slow but worth it
const zlib = await import("node:zlib");
const textEncoder = new TextEncoder();
const compressedFileContents = zlib.brotliCompressSync(
  textEncoder.encode(uncompressedFileContents)
);

await fs.writeFile(
  new URL(`../src/words/${lang}.json`, import.meta.url),
  uncompressedFileContents
);

const totalTime = performance.now() - startTime;

console.log("Processed word data in", totalTime, "ms");
console.log("Final word count:", finalWordList.length);
console.log("Final letter set count:", finalLetterSetList.length);

if (viableWords.length < allWords.length) {
  console.log(
    `Filtered out ${
      allWords.length - viableWords.length
    } words from the original list.`
  );
  await fs.writeFile(wordFilePath, viableWords.sort().join("\n"));
}
