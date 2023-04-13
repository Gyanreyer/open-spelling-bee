import workerpool from "workerpool";

function processLetterSet(letterSetChunk, wordTrie) {
  const processedLetterSetArrayChunk = [];

  const wordTrieNodes = new Map();
  const letterSetIndexMap = new Map();

  for (
    let i = 0, letterSetCount = letterSetChunk.length;
    i < letterSetCount;
    ++i
  ) {
    const letterSetString = letterSetChunk[i];

    const processedLetterSetArray = new Array(8);
    processedLetterSetArray[0] = letterSetString;

    letterSetIndexMap.clear();
    for (let j = 0; j < 7; ++j) {
      letterSetIndexMap.set(letterSetString[j], j + 1);
    }

    wordTrieNodes.clear();
    wordTrieNodes.set(wordTrie, {});

    const wordTrieNodeIterator = wordTrieNodes.entries();

    while (wordTrieNodes.size > 0) {
      const [wordTrieNode, letterSetIndices] =
        wordTrieNodeIterator.next().value;
      wordTrieNodes.delete(wordTrieNode);

      for (const [key, value] of Object.entries(wordTrieNode)) {
        if (key === "words") {
          for (const index of Object.keys(letterSetIndices)) {
            processedLetterSetArray[index] =
              processedLetterSetArray[index] || [];
            processedLetterSetArray[index].push(...value);
          }
        } else if (letterSetIndexMap.has(key)) {
          const letterIndex = letterSetIndexMap.get(key);
          if (letterSetIndices[letterIndex]) {
            wordTrieNodes.set(value, letterSetIndices);
          } else {
            wordTrieNodes.set(value, {
              ...letterSetIndices,
              [letterIndex]: true,
            });
          }
        }
      }
    }

    processedLetterSetArrayChunk.push(processedLetterSetArray);
  }

  return processedLetterSetArrayChunk;
}

workerpool.worker({
  processLetterSet,
});
