# Lesson Register

Record what you taught each lesson against your teaching program: what you used as planned, adapted, didn’t use or added, how the resources
worked, the adjustments you provided, and which syllabus content and outcomes were covered. Download the result as a PDF or Word document:
the program annotated with dates taught, changes, adjustments, a lesson log, syllabus coverage and your evaluation, in the same layout for
every class and subject.

- **Lesson times.** The school calendar (terms, Week A/B, days without classes) and each class’s timetable list every lesson to record,
  with its date, time and room. NSW public school dates for Term 4 2026 and 2027 can be filled in with one button.
- **Coverage matrix.** Outcomes and content points against units or terms for a class, and against every class following the same
  program for the faculty, on screen or as a download.
- **Resources.** Program resources are rated each lesson; anything else used (web pages, videos, worksheets, quizzes and so on) is added
  with its type and web address, and can be picked again in later lessons.
- **Worksheets from the Worksheet Maker.** Worksheets saved to Google Drive from the HSC Economics Worksheet Maker are listed
  under *Resources not in the program*, best matches for the lesson's topic first, and added as a Worksheet with its Drive link
  (see [below](#worksheets-from-the-worksheet-maker)).

Built for one teacher first, and for a whole faculty later: every teacher signs in to their own classes, and Head Teachers can read every
class in the faculty.

## How student information is handled

- The database stores students as codes only (S01, S02, …). Names typed into the app stay in that browser on that device, and are merged
  into a download on the device when the teacher asks.
- Each teacher can change only their own classes. Head Teachers and admins can read the classes in their faculty. These rules are
  enforced by the database (row-level security), not only by the app.
- The database is hosted in Australia (Sydney) if you choose that region when you create it.

Before colleagues start using it, check with your principal: NSW Department of Education guidance asks principals to do due diligence
before staff use services that aren’t provided by the department.

## Try it on your computer

```sh
cd lesson-register
npm install
npm run dev
```

With no database configured, the app runs in demo mode with sample data kept in the browser.

## Put it online (about 15 minutes, once)

1. **Create the database.** Sign in at [supabase.com](https://supabase.com) (you can use your GitHub account) and create a project.
   Choose the **Sydney** region and keep the database password somewhere safe.
2. **Set up the tables and rules.** In the project, open **SQL Editor**, paste everything in [`supabase/schema.sql`](supabase/schema.sql)
   and run it.
3. **Allow sign-ins from your site.** In **Authentication → URL Configuration**, set the Site URL to the site’s address,
   `https://phillippain.github.io/Tools/lesson-register/`, and add the same address under Redirect URLs.
   Optional: under **Authentication → Emails**, add `{{ .Token }}` to the Magic Link template so “Email me a code” shows a code.
4. **Copy two values** from the project’s API settings: the project URL and the **publishable** key (older projects call it the anon
   key). Never put the secret or service-role key in the site.
5. **Give them to GitHub.** In the Tools repository: **Settings → Secrets and variables → Actions → Variables**, add
   `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
6. **Turn on GitHub Pages.** **Settings → Pages → Build and deployment → Source: GitHub Actions.** Then open the **Actions** tab and
   run **Publish site** (it also runs on every push to `main`). It builds Lesson Register and publishes it together with the other
   tools in the repository, which keep their addresses (for example `…/Tools/interview-timekeeper/`).

The two workflows are in the repository’s top-level [`.github/workflows`](../.github/workflows) folder, because GitHub only runs
workflows from there.
7. **Start using it.** Open the site, create your account, choose **Set up your faculty**, add the Economics program on the Programs page,
   then add your class.

### Updating an existing database

When a new version adds features that need new columns, run the whole of [`supabase/schema.sql`](supabase/schema.sql) again in the SQL
Editor. It is safe to run more than once and keeps existing data. (The calendar, timetable, lesson times and rooms need this if your
database was set up before they were added.)

## Setting up the calendar and timetables

1. A Head Teacher or admin opens **Settings → Edit school calendar**, taps **Fill in NSW public school dates** (or enters the school’s own
   dates), adds any other days without classes, and saves.
2. Each teacher opens a class, then **Lessons → Timetable**, adds each time the class meets (Week A or B, day, period, start, end, room),
   and chooses the date to start from. Every timetabled lesson from then on appears in the Lessons tab to record.

## Adding colleagues

Open **Faculty** to see the join code. Colleagues create an account and join with the code; they start as teachers and see only their own
classes. An admin can make someone a Head Teacher from the same page.

## Worksheets from the Worksheet Maker

The HSC Economics Worksheet Maker (`phillippain.github.io/HSC-Economics/worksheet-maker/`) can save each worksheet into a
**Worksheets** folder in the topic's resources on the shared drive, through the teacher's own **Worksheet saver** (a Google Apps
Script web app in their school account; set up from the Worksheet Maker's *Save to Google Drive* dialog, code in
`HSC-Economics/worksheet-maker/drive-saver/`).

- Both tools are on the same site, so on a computer where the saver is set up, *Record lesson* lists the saved worksheets by itself:
  it reads the saver's address and private key from this browser (`worksheet-maker:drive`) and asks the saver for the list
  (`src/lib/worksheets.ts`, `src/components/WorksheetPicker.tsx`). Nothing about the saver is stored in the database.
- On another device, open *Worksheets from the Worksheet Maker* in *Resources not in the program* and paste the connection code
  from the Worksheet Maker (Save to Google Drive › Drive settings › Copy a connection code). *Disconnect this browser* removes it.
- If the saver can't be reached, the worksheets saved from this computer (`worksheet-maker:drive-saved`) are offered instead.
- A picked worksheet becomes an added resource of type Worksheet, with the Drive link to the student copy and the folder as its
  note, so it can be rated and appears under *Used before with this class* afterwards.

## Programs and syllabuses

- A program is a JSON file listing its units (lessons, weeks or blocks), each with activities, resources and the syllabus content and
  outcomes it covers. See [`src/lib/types.ts`](src/lib/types.ts) for the format and
  [`src/data/programs/eco-t34-2027.ts`](src/data/programs/eco-t34-2027.ts) for an example. Import new program files on the Programs page.
- A syllabus is a JSON file in [`src/data/syllabuses`](src/data/syllabuses), listed in [`src/lib/syllabus.ts`](src/lib/syllabus.ts).
  Labels are short forms for tracking, not the official wording. Adding a subject (any HSIE course) means adding its syllabus file and its
  programs; nothing else changes.

## Free plan limits

Supabase pauses free projects after about a week with no database activity. The **Lesson Register keep database awake** workflow makes one tiny call
twice a week so that doesn’t happen over the holidays. If the project is ever paused, open it in the Supabase dashboard and resume it;
data is kept. The free plan has no automatic backups, so download a backup from each class’s Export tab at the end of each term.

## Development

Run these inside `lesson-register/`:

```sh
npm test            # logic, Word and PDF export tests
npm run typecheck
npm run build       # the site, into dist/
npm run build:preview  # one self-contained demo file, into dist-preview/
```

PDF fonts: Roboto (SIL Open Font License) and a symbol subset of DejaVu Sans; licences are in [`src/fonts`](src/fonts).
