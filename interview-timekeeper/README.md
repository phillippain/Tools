# Interview Timekeeper

A single-page timer that keeps parent–teacher interviews on a fixed timetable. Each booking runs for a set length (7 minutes by default), the next one starts automatically, and a gentle chime sounds at the one-minute warning and at the end of each slot.

No install, no server, no accounts. It is one HTML file.

## Using it

1. Open `index.html` in a browser (or visit the GitHub Pages link if this repo has one).
2. Paste your bookings into the setup box, one per line, in the form
   `date, time, subject, class, parent, student`
   Commas or tabs both work, a header row is fine, and dates are read as day/month/year. Times like `4:07 PM` or `16:07` are accepted. You can also type plain student names, one per line, timed from the fallback start time.
3. Press **Save schedule**, then either
   - **Run to the timetable** to follow the booked times exactly, or
   - **Start first interview now** to shift the whole evening to begin this instant.

While it runs:

- The clock turns amber and chimes with one minute left, then red with an end chime as the next slot begins.
- Gaps in your bookings appear as breaks.
- **+1 min / −1 min** shift every slot. **Restart this slot now** re-anchors the current interview if a parent arrives late. Tapping any row jumps straight to it.
- **Sound on/off** mutes the chimes; **Test chime** plays one so you can set the volume beforehand.

Your list and settings are remembered in the browser you used, so the page survives a refresh mid-evening. Nothing is sent anywhere.

## Hosting for colleagues

Turn on GitHub Pages (Settings → Pages → deploy from the `main` branch, root folder) and share the link. Each person's bookings stay in their own browser.

## Notes

- Fonts load from Google Fonts; without internet the page falls back to system fonts and still works.
- Sound only starts after a click on the page, which is why the Start buttons also unlock audio.
- Works on phones and laptops; the screen is kept awake while the timer runs where the browser allows it.
