package main

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func getMapKeys[K comparable, V any](m map[K]V) []K {
	keys := make([]K, len(m))
	i := 0
	for key := range m {
		keys[i] = key
		i++
	}

	return keys
}

type TrieNode struct {
	char  rune
	chars map[rune]*TrieNode
	words []string
}

func makeTrieNode(char rune) *TrieNode {
	return &TrieNode{char: char, chars: make(map[rune]*TrieNode), words: make([]string, 0)}
}

func main() {
	wordFileContents, err := os.ReadFile("word-lists/en.txt")
	check(err)

	words := strings.Split(string(wordFileContents), "\n")

	fmt.Println("Read in", len(words), "words")

	letterSets := make(map[string]bool)

	// Create a Trie to store all valid words in a way that's quicker to look up
	// when trying to find which words belong to a letter set
	trie := makeTrieNode(rune(0))

	for _, word := range words {
		if len(word) < 4 {
			continue
		}

		uniqueCharSet := make(map[rune]bool)

		for _, char := range word {
			uniqueCharSet[char] = true
		}

		uniqueCharKeys := getMapKeys(uniqueCharSet)

		i := 0
		for char := range uniqueCharSet {
			uniqueCharKeys[i] = char
			i++
		}

		sort.Slice(uniqueCharKeys, func(i, j int) bool {
			return uniqueCharKeys[i] < uniqueCharKeys[j]
		})

		if len(uniqueCharKeys) == 7 {
			letterSets[string(uniqueCharKeys)] = true
		}

		currentTrieNode := trie
		for _, char := range uniqueCharKeys {
			nextTrieNode, ok := currentTrieNode.chars[char]
			if !ok {
				// Add a new node if it doesn't exist for this char
				nextTrieNode = makeTrieNode(char)
				currentTrieNode.chars[char] = nextTrieNode
			}

			currentTrieNode = nextTrieNode
		}
		currentTrieNode.words = append(currentTrieNode.words, word)
	}

	fmt.Println("Found", len(letterSets), "letter sets")

	c := make(chan LetterSetResult)

	for letterSet := range letterSets {
		go processLetterSet(letterSet, trie, c)
	}

	letterSetWords := make(map[string][]string)

	uniqueWordIndexMap := make(map[string]int)

	for i := 0; i < len(letterSets); i++ {
		letterSetResult := <-c
		letterSet := letterSetResult.letterSet

		for j := 0; j < 7; j++ {
			words := letterSetResult.words[j]
			wordCount := len(words)

			// Only include letter sets with 15-60 words; too few words or too many words aren't as fun
			if wordCount >= 10 && wordCount <= 60 {
				letterSetWords[letterSet+fmt.Sprintf("%d", j)] = words
				for k := 0; k < wordCount; k++ {
					uniqueWordIndexMap[words[k]] = -1
				}
			}
		}
	}

	fullWordList := make([]string, len(uniqueWordIndexMap))

	i := 0
	for word := range uniqueWordIndexMap {
		fullWordList[i] = word
		uniqueWordIndexMap[word] = i
		i++
	}

	sortedLetterSets := getMapKeys(letterSetWords)
	sort.Strings(sortedLetterSets)

	letterSetWordIndices := make([][]int, len(sortedLetterSets))

	for i, letterSet := range sortedLetterSets {
		words = letterSetWords[letterSet]
		wordCount := len(words)
		letterSetWordIndices[i] = make([]int, wordCount)
		for j := 0; j < wordCount; j++ {
			word := words[j]
			letterSetWordIndices[i][j] = uniqueWordIndexMap[word]
		}
	}

	letterSetJsonData := make([]interface{}, 3)

	letterSetJsonData[0] = fullWordList
	letterSetJsonData[1] = sortedLetterSets
	letterSetJsonData[2] = letterSetWordIndices

	json, err := json.Marshal(letterSetJsonData)
	check(err)

	compressedDataFile, _ := os.Create("src/words/en.json.gz")
	w := gzip.NewWriter(compressedDataFile)

	w.Write([]byte(json))
	w.Close()

	uncompressedDataFile, _ := os.Create("src/words/en.json")
	uncompressedDataFile.Write(json)
	uncompressedDataFile.Close()

	fmt.Println("Done! Generated data:", len(fullWordList), "words and", len(sortedLetterSets), "letter sets")
}

type LetterSetResult struct {
	letterSet string
	words     [][]string
}

type QueuedNode struct {
	parentCharIndices []int
	node              *TrieNode
}

func processLetterSet(letterSet string, rootTrieNode *TrieNode, c chan LetterSetResult) {
	nodeQueue := []QueuedNode{{parentCharIndices: make([]int, 0), node: rootTrieNode}}

	wordMap := make([]map[string]bool, 7)

	nextNodeIndex := 0
	nodeCount := len(nodeQueue)

	for nextNodeIndex < nodeCount {
		currentTrieNode := nodeQueue[nextNodeIndex].node
		parentCharIndices := nodeQueue[nextNodeIndex].parentCharIndices
		nextNodeIndex++

		for charIndex := 0; charIndex < 7; charIndex++ {
			char := rune(letterSet[charIndex])
			nextTrieNode, ok := currentTrieNode.chars[char]
			if ok {
				nextQueuedNode := QueuedNode{
					parentCharIndices: append(parentCharIndices, charIndex),
					node:              nextTrieNode,
				}
				nodeQueue = append(nodeQueue, nextQueuedNode)
				nodeCount++
			}

			charIndicesToAddWordsTo := parentCharIndices

			if char == currentTrieNode.char {
				charIndicesToAddWordsTo = append(charIndicesToAddWordsTo, charIndex)
			}

			for _, i := range charIndicesToAddWordsTo {
				for _, word := range currentTrieNode.words {
					if wordMap[i] == nil {
						wordMap[i] = make(map[string]bool)
					}

					wordMap[i][word] = true
				}
			}
		}
	}

	words := make([][]string, 7)

	for i := 0; i < 7; i++ {
		words[i] = getMapKeys(wordMap[i])
		sort.Strings(words[i])
	}

	c <- LetterSetResult{letterSet, words}
}
