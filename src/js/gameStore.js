document.addEventListener("alpine:init", () => {
  const wordFetchPromise = fetch("/words/en.json").then((res) => res.json());

  function shuffleArray(array) {
    const arrayCopy = array.slice();
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
    return {
      score: (word.length <= 4 ? 1 : word.length) + (isPanagram ? 7 : 0),
      isPanagram,
    };
  }

  const getRandomLetterSetIndices = async (seed = null) => {
    const [allWords, letterSetData] = await wordFetchPromise;

    // If we have a seed, make a seeded alea instance which will
    // predictably produce the same sequence of random numbers each time,
    // otherwise use Math.random
    const getRandomNumber = seed ? new alea(seed) : Math.random;

    const centerLetterIndex = Math.floor(
      getRandomNumber() * letterSetData.length
    );

    const [centerLetterCode, letterSetOptions] =
      letterSetData[centerLetterIndex];

    const outerLettersIndex = Math.floor(
      getRandomNumber() * letterSetOptions.length
    );

    return {
      centerLetterIndex,
      outerLettersIndex,
    };
  };

  const getDataForLetterSetIndices = async (
    centerLetterIndex,
    outerLettersIndex
  ) => {
    const [allWords, letterSetData] = await wordFetchPromise;

    const [centerLetterCode, letterSetOptions] =
      letterSetData[centerLetterIndex];

    const centerLetter = String.fromCharCode(centerLetterCode + 97);

    const [outerLetterString, wordIndices] =
      letterSetOptions[outerLettersIndex];

    const outerLetters = shuffleArray(outerLetterString.split(""));
    const validWords = wordIndices.map((index) => allWords[index]);

    return {
      centerLetter,
      outerLetters,
      validWords,
    };
  };

  Alpine.store("game", {
    centerLetterIndex: Alpine.$persist(null),
    centerLetter: "",
    outerLettersIndex: Alpine.$persist(null),
    outerLetters: [],
    validWords: [],
    guessedWords: Alpine.$persist([]),
    totalPossibleScore: 0,
    currentScore: 0,
    shouldChangePuzzleDaily: true,
    puzzleStartTimestamp: Alpine.$persist(null),
    invalidWordRegex: null,
    validWordRegex: null,
    async setUp() {
      if (this.shouldChangePuzzleDaily) {
        const lastPuzzleStartDate = new Date(this.puzzleStartTimestamp || 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today > lastPuzzleStartDate) {
          this.puzzleStartTimestamp = today.toISOString();
          return await this.getNewLetterSet(this.puzzleStartTimestamp);
        }
      }

      if (this.centerLetterIndex == null || this.outerLettersIndex == null) {
        await this.getNewLetterSet();
      } else {
        try {
          await this.hydrateLetterSetData();
        } catch (e) {
          // If something goes wrong while attempting to hydrate the data,
          // something may have been tampered with so we'll just bail out and get a new
          // letter set.
          await this.getNewLetterSet();
        }
      }
    },
    validateWord(word) {
      if (word.length < 4) {
        return {
          isValid: false,
          reason: "Words must be at least 4 letters long.",
        };
      }

      if (this.invalidWordRegex.test(word)) {
        return {
          isValid: false,
          reason: "Words can only contain the center letter and outer letters.",
        };
      }

      if (!this.validWordRegex.test(word)) {
        return {
          isValid: false,
          reason: "Words must include the center letter.",
        };
      }

      if (!this.validWords.includes(word)) {
        return {
          isValid: false,
          reason: "Not a valid word.",
        };
      }

      if (this.guessedWords.includes(word)) {
        return {
          isValid: false,
          reason: "You've already guessed that word.",
        };
      }

      return {
        isValid: true,
        ...getWordScore(word),
      };
    },
    submitGuess(guessWord) {
      if (!guessWord) return;

      const sanitizedWord = guessWord.toLowerCase();

      const { isValid, reason, score, isPanagram } =
        this.validateWord(sanitizedWord);

      if (isValid) {
        this.guessedWords.push(sanitizedWord);
        this.currentScore += score;
        window.dispatchEvent(
          new CustomEvent("valid-guess", {
            detail: {
              score,
              isPanagram,
            },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("invalid-guess", {
            detail: {
              reason,
            },
          })
        );
      }
    },
    shuffleOuterLetters() {
      this.outerLetters = shuffleArray(this.outerLetters);
    },
    async hydrateLetterSetData() {
      const { centerLetter, outerLetters, validWords } =
        await getDataForLetterSetIndices(
          this.centerLetterIndex,
          this.outerLettersIndex
        );
      this.centerLetter = centerLetter;
      this.outerLetters = shuffleArray(outerLetters);
      this.validWords = validWords;

      this.totalPossibleScore = this.validWords.reduce(
        (total, word) => total + getWordScore(word).score,
        0
      );

      // Sanitize the user's persisted list of guessed words to ensure there aren't duplicate words
      this.guessedWords = Array.from(new Set(this.guessedWords));

      // Calculate the user's current score based on their initial persisted list of guessed words
      this.currentScore = this.guessedWords.reduce(
        (total, word) => total + getWordScore(word).score,
        0
      );

      const outerLetterString = outerLetters.join("");

      this.invalidWordRegex = new RegExp(
        `[^${centerLetter}${outerLetterString}]`,
        "g"
      );
      this.validWordRegex = new RegExp(
        `^[${outerLetterString}]*${centerLetter}+[${outerLetterString}]*$`
      );
    },
    async getNewLetterSet(seed = null) {
      this.guessedWords = [];
      this.currentScore = 0;

      const { centerLetterIndex, outerLettersIndex } =
        await getRandomLetterSetIndices(seed);

      this.centerLetterIndex = centerLetterIndex;
      this.outerLettersIndex = outerLettersIndex;

      await this.hydrateLetterSetData();
    },
  });
});

document.addEventListener("alpine:initialized", () => {
  Alpine.store("game").setUp();
});
