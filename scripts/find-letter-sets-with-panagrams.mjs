// Script takes a json file with an array of words and generates a second json file
// with an array of letter sets that have at exactly 1-2 panagram words.

const fs = await import("node:fs/promises");

const fileContents = await fs.readFile("src/words/en/words.json", "utf-8");

const words = JSON.parse(fileContents);

const letterSets = new Map();

for (let i = 0, wordCount = words.length; i < wordCount; ++i) {
  const charSet = [];
  const word = words[i];

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

for (const [letterSet, words] of letterSets.entries()) {
  if (words.length < 3) {
    // We only want letter sets with 1-2 panagrams; any more stops feeling special
    usableLetterSets.push(letterSet);
  }
}

await fs.writeFile(
  "src/words/en/letterSets.json",
  JSON.stringify(usableLetterSets),
  "utf-8"
);
