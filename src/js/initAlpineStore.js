document.addEventListener("alpine:init", () => {
  function shuffleArray(array) {
    const arrayCopy = [...array];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
  }

  function getWordScore(word) {
    const uniqueChars = {};
    let uniqueCharCount = 0;

    for (let i = 0, len = word.length; i < len; ++i) {
      const char = word[i];
      if (!uniqueChars[char]) {
        uniqueChars[char] = true;
        ++uniqueCharCount;
      }
    }

    const isPanagram = uniqueCharCount === 7;
    return (word.length <= 4 ? 1 : word.length) + (isPanagram ? 7 : 0);
  }

  Alpine.store("words", {
    words: null,
    letterSetData: null,
    currentLetterSet: Alpine.$persist(null),
    currentCenterLetter: Alpine.$persist(null),
    outerLetters: Alpine.$persist([]),
    validWords: Alpine.$persist(null),
    invalidWordRegex: Alpine.$persist(null),
    totalPossibleScore: Alpine.$persist(null),
    guessedWords: Alpine.$persist([]),
    currentGuess: "",
    currentScore: Alpine.$persist(0),
    setUp() {
      if (
        !this.currentLetterSet ||
        !this.currentCenterLetter ||
        !this.validWords
      ) {
        this.getNewLetterSet();
      }
    },
    submitGuess() {
      if (!this.currentGuess) return;

      const word = this.currentGuess.toLowerCase();

      this.currentGuess = "";

      if (word.length < 3) {
        alert("Words must be at least 3 letters long!");
        return;
      }

      for (let i = 0, len = word.length; i < len; ++i) {
        const letter = word[i];
        if (!this.currentLetterSet.includes(letter)) {
          alert("You can't use that letter!");
          return;
        }
      }

      const wordData = this.validWords[word];

      if (!wordData) {
        alert("That's not a valid word!");
        return;
      }

      if (this.guessedWords.includes(word)) {
        alert("You already guessed that word!");
        return;
      }

      this.guessedWords.push(word);
      this.currentScore += wordData.points;
    },
    shuffleOuterLetters() {
      this.outerLetters = shuffleArray(this.outerLetters);
    },
    async getNewLetterSet() {
      if (!this.words || !this.letterSetData) {
        const [words, letterSetData] = await fetch("/words/en.json").then(
          (res) => res.json()
        );
        this.words = words;
        this.letterSetData = letterSetData;
      }

      this.guessedWords = [];
      this.currentScore = 0;

      const [centerLetterCode, letterSetOptions] =
        this.letterSetData[
          Math.floor(Math.random() * this.letterSetData.length)
        ];

      this.currentCenterLetter = String.fromCharCode(centerLetterCode + 97);

      const [outerLetterString, wordIndices] =
        letterSetOptions[Math.floor(Math.random() * letterSetOptions.length)];

      this.outerLetters = shuffleArray(outerLetterString.split(""));
      this.validWords = wordIndices.map((index) => this.words[index]);

      this.invalidWordRegex = new RegExp(
        `[^${this.currentCenterLetter}${outerLetterString}]`,
        "g"
      );
      this.validWordRegex = new RegExp(
        `^[${outerLetterString}]*${outerLetterString}+[${outerLetterString}]*$`
      );
    },
  });
});

document.addEventListener("alpine:initialized", () => {
  Alpine.store("words").setUp();
});
