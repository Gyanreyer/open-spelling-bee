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

    const letterSetIndex = Math.floor(getRandomNumber() * letterSetData.length);

    const centerLetterIndexOptions = [];

    const [letterSetString, ...centerLetterVariants] =
      letterSetData[letterSetIndex];

    for (let i = 0, len = centerLetterVariants.length; i < len; ++i) {
      if (centerLetterVariants[i].length > 0) {
        centerLetterIndexOptions.push(i);
      }
    }

    const centerLetterIndex = Math.floor(
      getRandomNumber() * centerLetterIndexOptions.length
    );

    return {
      letterSetIndex,
      centerLetterIndex,
    };
  };

  Alpine.store("game", {
    letterSetIndex: Alpine.$persist(null),
    centerLetterIndex: Alpine.$persist(null),
    centerLetter: "",
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

      if (this.letterSetIndex == null || this.centerLetterIndex == null) {
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
        for (
          let i = 0, guessedWordCount = this.guessedWords.length;
          i <= guessedWordCount;
          ++i
        ) {
          if (i === guessedWordCount) {
            this.guessedWords.push(sanitizedWord);
          } else if (
            // If the new word is alphabetically after the word at i, insert it as the next word
            sanitizedWord.localeCompare(this.guessedWords[i]) > 0
          ) {
            this.guessedWords.splice(i + 1, 0, sanitizedWord);
            break;
          }
        }
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
      const [allWords, letterSetData] = await wordFetchPromise;

      const letterSetString = letterSetData[this.letterSetIndex][0];

      this.centerLetter = letterSetString[this.centerLetterIndex];

      const letterSetCharacterArray = letterSetString.split("");

      this.outerLetters = shuffleArray(
        letterSetCharacterArray
          .slice(0, this.centerLetterIndex)
          .concat(letterSetCharacterArray.slice(this.centerLetterIndex + 1))
      );

      const validWordIndices =
        letterSetData[this.letterSetIndex][this.centerLetterIndex + 1];

      this.validWords = validWordIndices.map((index) => allWords[index]);

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

      this.invalidWordRegex = new RegExp(`[^${letterSetString}]`, "g");
      this.validWordRegex = new RegExp(
        `^[${letterSetString}]*${this.centerLetter}+[${letterSetString}]*$`
      );
    },
    async getNewLetterSet(seed = null) {
      this.guessedWords = [];
      this.currentScore = 0;

      const { letterSetIndex, centerLetterIndex } =
        await getRandomLetterSetIndices(seed);

      this.letterSetIndex = letterSetIndex;
      this.centerLetterIndex = centerLetterIndex;

      await this.hydrateLetterSetData();
    },
  });
});

document.addEventListener("alpine:initialized", () => {
  Alpine.store("game").setUp();
});
