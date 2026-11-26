# SEP Evidence Upload Tracker 2026 – Google Sheet version

Staff tick off numeracy and reading evidence once it is uploaded to their team folder. Every tick is recorded in a Google Sheet (who, when, optional note) with an audit log and a per-team summary.

## Files
- `Code.gs` – Apps Script back end (reads and writes the sheet)
- `Items.gs` – the 196 evidence items from the 2026 Numeracy and Reading trackers
- `Index.html` – the page staff use

## One-off setup (about 10 minutes)
1. In Google Drive, create a new Google Sheet, e.g. "SEP Evidence Tracker 2026 – record".
2. In the Sheet choose **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with this folder's `Code.gs`.
4. Add a **Script** file named `Items` and paste in `Items.gs`.
5. Add an **HTML** file named `Index` and paste in `Index.html`.
6. Run the `setup` function once (select `setup`, click Run, approve the permissions). The Sheet now has these tabs: **Ticks**, **Folders**, **Log**, **Summary**.
7. **Deploy > New deployment > Web app**
   - Execute as: **Me**
   - Who has access: **Anyone within [your organisation]**
8. Copy the web app URL and share it with staff.
9. Optional: paste each team's folder link into the **Folders** tab (column C, https links only), or let staff use "Set link" on the page.

## Notes
- Ticks save to the **Ticks** tab. Tick, untick and note changes are logged on the **Log** tab. **Summary** shows counts per team.
- Staff are identified by their Google email when their account is in the same organisation as the Sheet owner. If Google cannot supply an email, the page asks for a name once.
- Anyone who can open the web app can tick any item, so keep access limited to staff.
- After changing the code, use **Deploy > Manage deployments > Edit > New version**, otherwise staff keep seeing the old one.
- If your school's Google admin blocks Apps Script web apps or sharing within the organisation, ask them to allow it.
- Upload de-identified student work only.
