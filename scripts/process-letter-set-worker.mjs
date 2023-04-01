import workerpool from "workerpool";

function processLetterSet(letterSetChunk, viableWordList) {
  const processedLetterSetArrayChunk = [];

  for (
    let i = 0, letterSetCount = letterSetChunk.length;
    i < letterSetCount;
    ++i
  ) {
    const letterSetString = letterSetChunk[i];
    const regex = new RegExp(`^[${letterSetString}]*$`);

    const processedLetterSetArray = new Array(8);
    processedLetterSetArray[0] = letterSetString;

    for (let j = 0, wordCount = viableWordList.length; j < wordCount; ++j) {
      const word = viableWordList[j];

      if (regex.test(word)) {
        for (let k = 0; k < 7; ++k) {
          const char = letterSetString[k];
          if (word.includes(char)) {
            const charWordListIndex = k + 1;
            if (!processedLetterSetArray[charWordListIndex]) {
              processedLetterSetArray[charWordListIndex] = [];
            }
            processedLetterSetArray[charWordListIndex].push(word);
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
