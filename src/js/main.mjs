// mulberry32 seeded PRNG
const seededRandom = (seed) => () => {
  var t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const randomInRange = (min, max) => Math.random() * (max - min) + min;

// Uses tsparticles-confetti to fire a fancy confetti effect for celebrations
const fireConfetti = async (canvasId) => {
  const canvas = document.getElementById(canvasId);

  // you should  only initialize a canvas once, so save this function
  // we'll save it to the canvas itself for the purpose of this demo
  canvas.confetti = canvas.confetti || (await confetti.create(canvas));

  canvas.confetti({
    angle: randomInRange(75, 105),
    spread: randomInRange(50, 70),
    particleCount: randomInRange(30, 45),
    origin: { y: 0.8 },
  });
};

const importPersist = import(
  "https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.x.x/dist/module.esm.js"
);
const Alpine = (
  await import("https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js")
).default;

document.addEventListener("alpine:init", () => {
  function getID() {
    return Math.random().toString(36);
  }

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
      const id = getID();
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
          fireConfetti("panagram-confetti");

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
      this.scoreMilestones = this.scoreMilestones.map((milestone) => ({
        ...milestone,
        score: Math.floor(this.totalPossibleScore * milestone.percent),
      }));

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

  let wordPageIntersectionObserver = null;

  // MutationObserver to detect when a word page is removed from the DOM so we can stop observing it
  const wordPageMutationObserver = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      for (const removedNode of mutation.removedNodes) {
        wordPageIntersectionObserver?.unobserve(removedNode);
      }
    }
  });

  Alpine.data("wordPageWrapper", () => ({
    init() {
      wordPageIntersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const pageButton = document.getElementById(
              entry.target.getAttribute("page-button-id")
            );
            if (pageButton) {
              pageButton.style.setProperty(
                "--page-scroll-pct",
                `${entry.intersectionRatio * 100}%`
              );
            }
          });
        },
        {
          root: document.getElementById("word-page-wrapper"),
          // The observer will fire every time an element's visibility changes by >=10% to allow us
          // to have a slightly more fine-grained/smooth animation of the page buttons
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        }
      );
      wordPageMutationObserver.observe(this.$el, {
        childList: true,
      });
    },
  }));

  Alpine.data("previousGuesses", () => ({
    maxPageSize: 24,
    mostRecentGuessedWords: [],
    guessedWordPages: [],
    init() {
      this.$watch("$store.game.guessedWords", (value) => {
        const mostRecentGuessedWords = new Array(value.length);
        const guessedWordPages = [];

        for (let i = 0, wordCount = value.length; i < wordCount; ++i) {
          const word = value[i];

          // The guessedWords array is in chronological order of when the guesses were submitted,
          // so we just need to reverse it
          mostRecentGuessedWords[wordCount - 1 - i] = word;

          // Split the guessed words into pages of <=24 words each
          const lastPage = guessedWordPages[guessedWordPages.length - 1];

          if (!lastPage || lastPage.words.length === this.maxPageSize) {
            guessedWordPages.push({
              id: getID(),
              words: [word],
            });
          } else {
            lastPage.words.push(word);
          }
        }

        this.mostRecentGuessedWords = mostRecentGuessedWords;
        this.guessedWordPages = guessedWordPages;
      });
    },
  }));

  Alpine.data("guessedWordPage", () => ({
    init() {
      wordPageIntersectionObserver?.observe(this.$el);
    },
  }));

  Alpine.data("winModal", () => ({
    init() {
      this.$watch("currentMilestone", (milestone) => {
        if (milestone.name === "Genius" || milestone.name === "Master") {
          this.$el.showModal();
          fireConfetti("win-confetti");
        }
      });
    },
  }));
});

document.addEventListener("alpine:initialized", () => {
  Alpine.store("game").setUp();
});

window.Alpine = Alpine;
const { default: persist } = await importPersist;
Alpine.plugin(persist);
Alpine.start();
