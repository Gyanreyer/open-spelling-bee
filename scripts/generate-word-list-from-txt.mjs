// Script to take a raw txt file with a list of words and generate a json file
// with only the words that are viable for the spelling bee game
// (longer than 4 chars, only has at most 6 unique chars).
// TODO: extend this to accept args for different languages

const wordFilePath = process.argv[2];

if (!wordFilePath) {
  throw new Error("Please provide a file path to the word list json file");
}

const fs = await import("node:fs/promises");

const fileContents = await fs.readFile(wordFilePath, "utf-8");

const allWords = fileContents.split(/\s/);

const getUniqueCharacterCount = (word) => {
  const uniqueChars = new Set();
  for (let i = 0, charCount = word.length; i < charCount; ++i) {
    uniqueChars.add(word[i]);
  }
  return uniqueChars.size;
};

const spellingBeeViableWords = allWords.filter(
  (word) => word.length >= 4 && getUniqueCharacterCount(word) <= 7
);

await fs.writeFile(
  "src/_data/words/en/words.json",
  JSON.stringify(spellingBeeViableWords),
  "utf-8"
);
