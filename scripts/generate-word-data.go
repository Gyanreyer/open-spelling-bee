package main

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"unicode"
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
			for i := 0; i < 7; i++ {
				// Add each permutation of the letter set where one of the letters is capitalized to indicate it's the center letter
				letterSet := string(uniqueCharKeys[:i]) + string(unicode.ToUpper(uniqueCharKeys[i])) + string(uniqueCharKeys[i+1:])
				letterSets[letterSet] = true
			}
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

		words := letterSetResult.words
		wordCount := len(words)

		// Only include letter sets with 25-50 words; too few words or too many words aren't as fun
		if wordCount >= 25 && wordCount <= 50 {
			letterSetWords[letterSet] = words
			for k := 0; k < wordCount; k++ {
				uniqueWordIndexMap[words[k]] = -1
			}
		}
	}

	fullWordList := getMapKeys(uniqueWordIndexMap)
	sort.Strings(fullWordList)

	for i, word := range fullWordList {
		uniqueWordIndexMap[word] = i
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
	words     []string
}

type NodeQueueEntry struct {
	parentQueueEntry *NodeQueueEntry
	node             *TrieNode
	hasCenterLetter  bool
}

func processLetterSet(letterSet string, rootTrieNode *TrieNode, c chan LetterSetResult) {
	// Find the index of the uppercase letter in the letter set, which indicates the center letter
	centerLetterIndex := strings.IndexFunc(letterSet, func(r rune) bool {
		return unicode.IsUpper(r)
	})

	normalizedLetterSet := strings.ToLower(letterSet)
	centerLetter := rune(normalizedLetterSet[centerLetterIndex])

	nodesToProcess := []*NodeQueueEntry{{parentQueueEntry: nil, node: rootTrieNode, hasCenterLetter: false}}

	wordMap := make(map[string]bool)

	processedNodeCount := 0
	nodeCount := len(nodesToProcess)

	for processedNodeCount < nodeCount {
		currentQueuedNode := nodesToProcess[processedNodeCount]
		processedNodeCount++

		currentTrieNode := currentQueuedNode.node

		for _, char := range normalizedLetterSet {
			hasCenterLetter := currentQueuedNode.hasCenterLetter || char == centerLetter

			nextTrieNode, ok := currentTrieNode.chars[char]
			if ok {
				nextQueuedNode := &NodeQueueEntry{
					parentQueueEntry: currentQueuedNode,
					node:             nextTrieNode,
					hasCenterLetter:  hasCenterLetter,
				}
				nodesToProcess = append(nodesToProcess, nextQueuedNode)
				nodeCount++
			}

			if !hasCenterLetter || len(currentTrieNode.words) == 0 {
				continue
			}

			// Add all words from the current node to the word map for the current queued node + all of the characters for its parent queued nodes
			for qn := currentQueuedNode; qn != nil && qn.hasCenterLetter; qn = qn.parentQueueEntry {
				for _, word := range currentTrieNode.words {
					wordMap[word] = true
				}
			}
		}
	}

	words := getMapKeys(wordMap)
	sort.Strings(words)

	c <- LetterSetResult{letterSet, words}
}
