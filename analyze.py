#!/usr/bin/env python3
"""
Korean morpheme analyzer using kiwipiepy (C++ based, no Java required)
Extracts nouns (NNG: common nouns, NNP: proper nouns) from text
"""
import sys
import json

try:
    sys.stdin.reconfigure(encoding='utf-8', errors='replace')
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

def analyze(texts, stopwords=None, min_len=2):
    if stopwords is None:
        stopwords = []
    stopwords_set = set(w.lower() for w in stopwords)

    try:
        from kiwipiepy import Kiwi
        kiwi = Kiwi()
        use_kiwi = True
    except Exception:
        use_kiwi = False

    word_freq = {}
    doc_words = []

    for text in texts:
        if not text or not isinstance(text, str):
            doc_words.append([])
            continue

        if use_kiwi:
            tokens = kiwi.tokenize(text.strip())
            nouns = []
            for token in tokens:
                word = token.form
                tag = str(token.tag)
                if tag in ('NNG', 'NNP', 'SL') and len(word) >= min_len and word.lower() not in stopwords_set:
                    nouns.append(word)
                    word_freq[word] = word_freq.get(word, 0) + 1
        else:
            import re
            words = re.findall(r'[가-힣a-zA-Z]{2,}', text)
            nouns = [w for w in words if len(w) >= min_len and w.lower() not in stopwords_set]
            for w in nouns:
                word_freq[w] = word_freq.get(w, 0) + 1

        doc_words.append(nouns)

    return {
        'wordFreq': word_freq,
        'docWords': doc_words,
        'usedKiwi': use_kiwi,
        'totalDocs': len(texts),
        'totalWords': sum(word_freq.values()),
        'uniqueWords': len(word_freq)
    }

if __name__ == '__main__':
    try:
        data = json.loads(sys.stdin.read())
        result = analyze(
            data.get('texts', []),
            data.get('stopwords', []),
            data.get('minLen', 2)
        )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
