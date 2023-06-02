# Open Spelling Bee

An open-source Spelling Bee game for the web.

There will likely be words you think should be valid which are not included in the current word list!  Contributions to add missing words are strongly encouraged!

## Other languages

This project currently only includes support for English, but I would love to support other languages in the future!

## Credits

- [The bee icon used for this project was created by Freepik - Flaticon](https://www.flaticon.com/free-icons/bee)
- The base list of English words is taken from the [excellent list of words from https://github.com/en-wl/wordlist](https://github.com/en-wl/wordlist/blob/master/alt12dicts/2of4brif.txt).

## Development

### Setup

`npm install`

### Building the page

#### For development

`npm run dev` (or `npx @11ty/eleventy --serve`)

#### For production

`npm run build` (or `npx @11ty/eleventy`)

### Updating the word list

The master word list is located at `word-lists/en.txt`.

You can add words to this list, and then run the following script (making sure you have golang installed):

`go run scripts/generate-word-data.go`

This will consume the word list at `word-lists/en.txt` and generate a new updated word data set at `src/words/en.json` which can be used in the game.

Note that this may disrupt the order of the letter sets, so releasing a newly updated word data set during the day could disrupt users who have already loaded a different letter set for the day.
