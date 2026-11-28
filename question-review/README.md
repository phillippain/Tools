# Question review

Approve, flag or remove the questions Claude wrote for the HSC Economics
[Worksheet Maker](https://phillippain.github.io/HSC-Economics/worksheet-maker/), one click each: the HSC bank
(2009 syllabus dot points) and the Year 11 bank (2025 syllabus, files `y11-*.txt`). The course and topic filter
shows one course, topic or focus area at a time.

- `index.html` – the page (one file). Published at `https://phillippain.github.io/Tools/question-review/`.

## How it works

- The page reads the questions from the Worksheet Maker: `HSC-Economics/worksheet-maker/review-data.json`,
  which `worksheet-maker/build.py` writes. It holds every question and true/false statement in the bank
  (`worksheet-maker/bank/*.txt`), each with its answer and a fingerprint.
- Your decisions are saved in `HSC-Economics/worksheet-maker/bank/reviews.json`:
  - `ok`: approved. The question loses its "not yet reviewed" label in the Worksheet Maker.
  - `fix`: needs a fix, with your note. The Worksheet Maker leaves it out of new worksheets until it is fixed.
    Ask Claude to "fix the flagged questions": it reads the notes, edits the bank files and rebuilds.
  - `out`: removed. The Worksheet Maker leaves it out of new worksheets.
- Each decision stores the question's fingerprint. If a question is changed later (for example, after a fix),
  it comes back on the list as "changed since your decision".
- The Worksheet Maker reads `reviews.json` every time it opens, so no rebuild is needed.

## Saving

- **Connected to GitHub** (once per computer): press **Connect GitHub…** and paste a fine-grained personal
  access token for the HSC-Economics repository with **Contents: Read and write**. Each save is one commit
  to HSC-Economics (which rebuilds that site), so decisions are saved in batches: once 25 are waiting, three
  minutes after the first unsaved one, when you switch away from or close the tab, or when you press
  **Save now**. Until then they are kept in the browser, and any left over are saved next time the page opens.
  The Worksheet Maker sees them a minute or two after each save. Pull in GitHub Desktop before you next push
  HSC-Economics, since these commits are made on GitHub.
  The token stays in that browser (local storage, or session storage if *Remember it* is off) and is sent
  only to api.github.com. Every page on `phillippain.github.io` shares that storage, so connect only on a
  computer you trust, and use **Disconnect** on any other.
- **Not connected**: decisions are kept in the browser. **Copy decisions for Claude** or **Download them**,
  then ask Claude to apply them.

Keys: J and K move between questions; A approves, F flags for a fix, R removes, U undoes.
