import Alpine from "alpinejs";
import persist from "@alpinejs/persist";

// mulberry32 seeded PRNG
const seededRandom = (seed) => () => {
  var t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const fireConfetti = () => {
  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  confetti({
    angle: randomInRange(55, 125),
    spread: randomInRange(50, 70),
    particleCount: randomInRange(50, 100),
    origin: { y: 0.5 },
  });
};

document.addEventListener("alpine:init", () => {
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

  Alpine.store("game", {
    centerLetter: Alpine.$persist(""),
    outerLetters: Alpine.$persist([]),
    validWords: Alpine.$persist([]),
    guessedWords: Alpine.$persist([]),
    totalPossibleScore: 0,
    currentScore: 0,
    shouldChangePuzzleDaily: true,
    puzzleStartTimestamp: Alpine.$persist(null),
    invalidWordRegex: null,
    validWordRegex: null,
    notifications: [],
    scoreMilestones: [
      {
        percent: 0,
        name: "Beginner",
      },
      {
        percent: 0.02,
        name: "Good start",
      },
      {
        percent: 0.05,
        name: "Moving up",
      },
      {
        percent: 0.08,
        name: "Good",
      },
      {
        percent: 0.15,
        name: "Solid",
      },
      {
        percent: 0.25,
        name: "Nice",
      },
      {
        percent: 0.4,
        name: "Great",
      },
      {
        percent: 0.5,
        name: "Amazing",
      },
      {
        percent: 0.7,
        name: "Genius",
      },
      {
        percent: 1,
        name: "Master",
      },
    ],
    async setUp() {
      if (this.shouldChangePuzzleDaily) {
        const lastPuzzleStartDate = new Date(this.puzzleStartTimestamp || 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today > lastPuzzleStartDate) {
          this.puzzleStartTimestamp = today.getTime();
          return await this.getNewLetterSet(this.puzzleStartTimestamp);
        }
      }

      if (
        !this.centerLetter ||
        (this.outerLetters?.length ?? 0) === 0 ||
        (this.validWords?.length ?? 0) === 0
      ) {
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
    showNotification(notificationConfig) {
      const id = Math.random().toString(36);
      const aliveTime = 1500 + notificationConfig.message.length * 50;

      this.notifications.push({
        id,
        aliveTime,
        show: false,
        ...notificationConfig,
      });

      setTimeout(() => {
        this.notifications = this.notifications.filter((n) => n.id !== id);
      }, aliveTime);
    },
    submitGuess(guessWord) {
      if (!guessWord) return;

      const sanitizedWord = guessWord.toLowerCase();

      const { isValid, reason, score, isPanagram } =
        this.validateWord(sanitizedWord);

      if (isValid) {
        this.guessedWords.push(sanitizedWord);

        this.currentScore += score;

        if (isPanagram) {
          fireConfetti();

          this.showNotification({
            class: "valid-guess gradient-bg panagram",
            message: `Panagram! +${score}`,
            ariaLabel: `${sanitizedWord} is a panagram. Good job! +${score} points.`,
          });
        } else {
          this.showNotification({
            class: "valid-guess gradient-bg",
            message: `+${score}`,
            ariaLabel: `Correct! +${score} points.`,
          });
        }
      } else {
        this.showNotification({
          class: "invalid-guess",
          message: reason,
          ariaLabel: reason,
        });
      }
    },
    shuffleOuterLetters() {
      this.outerLetters = shuffleArray(this.outerLetters);
    },
    async hydrateLetterSetData() {
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

      const letterSetString = `${this.centerLetter}${this.outerLetters.join(
        ""
      )}`;

      this.invalidWordRegex = new RegExp(`[^${letterSetString}]`, "g");
      this.validWordRegex = new RegExp(
        `^[${letterSetString}]*${this.centerLetter}+[${letterSetString}]*$`
      );
    },
    async getNewLetterSet(seed = null) {
      const [allWords, letterSets, letterSetVariants] = await fetch(
        "/words/en.json"
      ).then((res) => res.json());

      let getRandomNumber = Math.random;

      if (seed) {
        // If we have a seed, make a seeded alea instance which will
        // predictably produce the same sequence of random numbers each time
        getRandomNumber = seededRandom(seed);
      }

      const [[letterSetIndex, centerLetterIndex], validWordIndices] =
        letterSetVariants[
          Math.floor(getRandomNumber() * letterSetVariants.length)
        ];

      const letterSetString = letterSets[letterSetIndex];
      this.centerLetter = letterSetString[centerLetterIndex];
      this.outerLetters = shuffleArray(
        (
          letterSetString.slice(0, centerLetterIndex) +
          letterSetString.slice(centerLetterIndex + 1)
        ).split("")
      );

      this.validWords = validWordIndices.map((i) => allWords[i]);

      this.guessedWords = [];
      this.currentScore = 0;

      await this.hydrateLetterSetData();
    },
  });

  // Define custom LetterButton component
  Alpine.bind("LetterButton", () => ({
    tabindex: "-1",
    "aria-hidden": "true",
    type: "button",
    "x-data": "{ letter: '' }",
    "x-modelable": "letter",
    "x-text": "letter",
    "@click": "guess += letter",
  }));
});

document.addEventListener("alpine:initialized", () => {
  Alpine.store("game").setUp();
});

window.Alpine = Alpine;
Alpine.plugin(persist);
Alpine.start();