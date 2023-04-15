// mulberry32 seeded PRNG
const seededRandom = (seed) => () => {
  var t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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

const importIdb = import("https://cdn.jsdelivr.net/npm/idb@7/+esm");

async function openGameDB() {
  const { openDB } = await importIdb;
  return openDB("SpellingBee", 1, {
    upgrade(db) {
      db.createObjectStore("dailyGames", {
        keyPath: "timestamp",
      });
    },
  });
}

let wordData;
async function loadWordData() {
  if (!wordData) {
    const importBrotli = import(
      "https://cdn.jsdelivr.net/npm/brotli-compress@1.3.3/js.mjs"
    );
    wordData = await fetch("/words/en.json.br")
      .then((res) => res.arrayBuffer())
      .then(async (compressedData) => {
        const brotli = await importBrotli;
        const decompressedData = brotli.decompress(compressedData);
        const text = new TextDecoder().decode(decompressedData);
        return JSON.parse(text);
      });
  }
  return wordData;
}

const GENIUS_PERCENT_THRESHOLD = 0.7;

Alpine.store("game", {
  timestamp: 0,
  centerLetter: "",
  outerLetters: new Array(6).fill(""),
  validWords: [],
  guessedWords: [],
  totalPossibleScore: 0,
  currentScore: 0,
  get invalidWordRegex() {
    const letterSetString = `${this.centerLetter}${this.outerLetters.join("")}`;
    return new RegExp(`[^${letterSetString}]`, "g");
  },
  get validWordRegex() {
    const letterSetString = `${this.centerLetter}${this.outerLetters.join("")}`;
    return new RegExp(
      `^[${letterSetString}]*${this.centerLetter}+[${letterSetString}]*$`
    );
  },
  notifications: [],
  currentRank: null,
  nextRank: null,
  isGenius: false,
  isMaster: false,
  get geniusScoreThreshold() {
    return Math.floor(GENIUS_PERCENT_THRESHOLD * this.totalPossibleScore);
  },
  ranks: [
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
      percent: GENIUS_PERCENT_THRESHOLD,
      name: "Genius",
    },
    {
      percent: 1,
      name: "Master",
    },
  ],
  async syncWithDB() {
    try {
      const gameDB = await openGameDB();
      const gameData = await gameDB.get("dailyGames", this.timestamp);
      gameDB.close();

      if (gameData) {
        this.centerLetter = gameData.centerLetter;
        this.outerLetters = gameData.outerLetters;
        this.validWords = gameData.validWords;
        // Sanitize the user's persisted list of guessed words to ensure there aren't duplicate words
        this.guessedWords = Array.from(new Set(gameData.guessedWords));
        // Calculate the user's current score based on their initial persisted list of guessed words
        this.updateScore(
          this.guessedWords.reduce(
            (total, word) => total + getWordScore(word).score,
            0
          )
        );
      } else {
        await this.getNewLetterSet(this.timestamp);
      }
    } catch (e) {
      console.error("Error retrieving existing data for today's game", e);
      // If something goes wrong while attempting to hydrate the data,
      // something may have been tampered with so we'll just bail out and get a new
      // letter set.
      await this.getNewLetterSet(this.timestamp);
    }
  },
  updateDB() {
    const timestamp = this.timestamp;
    const centerLetter = this.centerLetter;
    const outerLetters = this.outerLetters.slice();
    const validWords = this.validWords.slice();
    const guessedWords = this.guessedWords.slice();

    return openGameDB()
      .then((gameDB) =>
        gameDB
          .put("dailyGames", {
            timestamp,
            centerLetter,
            outerLetters,
            validWords,
            guessedWords,
          })
          .then(() => gameDB.close())
      )
      .catch((e) => console.error("Error updating DB", e));
  },
  async init() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.timestamp = today.getTime();

    await this.syncWithDB();

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.syncWithDB();
      }
    });

    // Set up an effect to update the IndexedDB store whenever the game data changes.
    Alpine.effect(this.updateDB.bind(this));

    const updateTotalPossibleScore = () => {
      const validWords = this.validWords;

      this.totalPossibleScore = validWords.reduce(
        (total, word) => total + getWordScore(word).score,
        0
      );
    };
    Alpine.effect(updateTotalPossibleScore.bind(this));

    const updateCurrentRank = () => {
      const currentScore = this.currentScore;
      const totalPossibleScore = this.totalPossibleScore;
      const ranks = this.ranks;

      if (!totalPossibleScore) return;

      const currentRankPercent = currentScore / totalPossibleScore;

      this.isGenius = currentRankPercent >= GENIUS_PERCENT_THRESHOLD;
      this.isMaster = currentRankPercent >= 1;

      for (let i = ranks.length - 1; i >= 0; --i) {
        const rank = ranks[i];
        if (currentRankPercent >= rank.percent || i === 0) {
          this.currentRank = rank;
          this.nextRank = ranks[i + 1];
          break;
        }
      }
    };
    Alpine.effect(updateCurrentRank.bind(this));
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
  updateScore(newScore) {
    this.currentScore = newScore;
  },
  submitGuess(guessWord) {
    if (!guessWord) return;

    const sanitizedWord = guessWord.toLowerCase();

    const { isValid, reason, score, isPanagram } =
      this.validateWord(sanitizedWord);

    if (isValid) {
      this.guessedWords.push(sanitizedWord);

      this.updateScore(this.currentScore + score);

      if (isPanagram) {
        window.fireConfetti("panagram-confetti");

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
  async getNewLetterSet(dateTimestamp) {
    const [allWords, letterSets, letterSetVariants] = await loadWordData();
    let getRandomNumber = seededRandom(dateTimestamp);

    const [[letterSetIndex, centerLetterIndex], validWordIndices] =
      letterSetVariants[
        Math.floor(getRandomNumber() * letterSetVariants.length)
      ];

    const letterSetString = letterSets[letterSetIndex];
    const centerLetter = letterSetString[centerLetterIndex];
    const outerLetters = shuffleArray(
      (
        letterSetString.slice(0, centerLetterIndex) +
        letterSetString.slice(centerLetterIndex + 1)
      ).split("")
    );

    const validWords = validWordIndices.map((i) => allWords[i]);
    const guessedWords = [];

    this.centerLetter = centerLetter;
    this.outerLetters = outerLetters;
    this.validWords = validWords;
    this.guessedWords = guessedWords;
    this.updateScore(0);
  },
});
