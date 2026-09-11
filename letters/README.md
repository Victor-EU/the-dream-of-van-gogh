# The letters

Every line of his letters the piece shows, and how to check each one.

DESIGN 9 asks for one line from his own letters per station, and for every quotation to be verified against the Van
Gogh Museum and Huygens ING edition before it ships: he is among the most misquoted people in art, and no line goes
in from memory. So a person chooses a line -- a letter, a paragraph, the words, and the canvas it should appear at --
and everything else about it is read off the edition by `tools/letters.py`: the recipient, the place, the date, and
whether the edition's own notes say the passage is about that canvas. The line then sits in its station file's
`letter`, which is what the page reads.

## Checking them

    tools/letters.py --check

reads the edition's pages for each line's letter, and exits 1 unless all of this is so:

- the letter exists, and the recipient, place and date in the station file are the edition's own words;
- every fragment of the line, split at the ellipsis, is in the named paragraph of the edition's English translation,
  verbatim and in order -- or, for the letters he wrote in English, in his original -- and a line that starts or
  stops inside a sentence has an ellipsis there to say so;
- the canvas the line appears at is one the edition's own note says the passage is about, matched on the holder, the
  title and the size; or, where the passage names no canvas the piece has, the station file says why the line stands
  where it does, and none of the notes around it names one;
- the letter was written inside the station's span, a fortnight either side;
- and `letters.json` is what the station files and the edition say now.

`letters.json` is the record a stranger reads: for each line the letter and its concordance numbers, the paragraph,
the words, the paragraph he wrote in the language he wrote it, the work the edition identifies, and the edition's two
stable links, `https://vangoghletters.org/en/let<n>` for the translation and `.../orig/let<n>` for the original.

## The lines

Ten, for eleven stations: the end has none. Station 7 had none while it was *The strokes stop*, because the strokes
stopped there and so did everything else; since then it has become the red vineyard, and it has his words about the
place.

| station | letter | to | date | at | tied to the canvas by | the words are |
|---|---|---|---|---|---|---|
| 1 | [499](https://vangoghletters.org/en/let499) | Theo van Gogh | on or about 2 May 1885 | *The Potato Eaters* | the edition's note 2: The potato eaters, F 82 | the edition's translation |
| 2 | [569](https://vangoghletters.org/en/let569) | Horace Mann Livens | September or October 1886 | *Self-Portrait* | its station file's `why` | his English |
| 3 | [594](https://vangoghletters.org/en/let594) | Theo van Gogh | 9 April 1888 | *The White Orchard* | its station file's `why` | the edition's translation |
| 4 | [627](https://vangoghletters.org/en/let627) | John Peter Russell | on or about 17 June 1888 | *The Harvest (The Blue Cart)* | its station file's `why` | his English |
| 5 | [705](https://vangoghletters.org/en/let705) | Theo van Gogh | 16 October 1888 | *The Bedroom* | the edition's note 1: The bedroom, F 482 | the edition's translation |
| 6 | [676](https://vangoghletters.org/en/let676) | Theo van Gogh | 8 September 1888 | *The Night Cafe* | the edition's note 7: The night café, F 463 | the edition's translation |
| 7 | [717](https://vangoghletters.org/en/let717) | Theo van Gogh | on or about 3 November 1888 | *The Red Vineyard* | its station file's `why` | the edition's translation |
| 8 | [782](https://vangoghletters.org/en/let782) | Theo van Gogh | on or about 18 June 1889 | *The Starry Night* | the edition's note 8: Starry night, F 612 | the edition's translation |
| 9 | [879](https://vangoghletters.org/en/let879) | Willemien van Gogh | 5 June 1890 | *The Church at Auvers* | the edition's note 8: Church at Auvers, F 789 | the edition's translation |
| 10 | [898](https://vangoghletters.org/en/let898) | Theo van Gogh and Jo van Gogh-Bonger | on or about 10 July 1890 | *Wheatfield with Crows* | the edition's note 4: Wheatfield with crows, F 779 | the edition's translation |

## Whose words these are

Two of the ten are his words exactly: he wrote to Horace Mann Livens and to John Peter Russell in English. The other
eight are the edition's English translation of what he wrote in Dutch or French, and `letters.json` carries his
original paragraph beside each one.

The texts are from

> Leo Jansen, Hans Luijten, Nienke Bakker (eds.) (2009), Vincent van Gogh - The Letters. Version: December 2024. Amsterdam & The Hague: Van Gogh Museum & Huygens ING. https://vangoghletters.org

which publishes its source files under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
licence (CC BY-NC-SA 4.0; the edition's *About* pages, section 6.4). The quotations here, in `letters.json` and in the
`letter` of each station file are used on those terms: attributed as above, not for any commercial purpose, and
shared alike. The rest of the repository is MIT (DESIGN 16); these are not. The edition's web pages themselves carry
an all-rights-reserved notice, and `tools/letters.py` reads them only to check -- one page at a time, half a second
apart -- keeping what it read in `letters/.cache/`, which is never committed.
