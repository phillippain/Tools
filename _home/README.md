# Staff home page (password-protected)

The site's home page (`../index.html`) is a locked page: the list of staff tools is encrypted, and it only
appears after the staff password is typed. This folder holds what builds it.

- `home.html` – the real home page (headings and links). **Kept on this computer only**: it is listed in
  `.gitignore`, because this repository is public and anything committed can be read by anyone.
- `lock-template.html` – the lock screen and the page's styling.
- `Lock home page.command` – builds `../index.html` from the two files above.

## Set or change the password, or change the links

1. Edit `home.html` if the links are changing. Keep its first line, `<!-- staff-home -->`, as it is.
2. Double-click `Lock home page.command` and type the password twice (12 or more characters).
   If macOS won't open it, open Terminal and run `bash ` followed by the file dragged into the window.
3. Commit and push. The site updates in a minute or two.

Changing the password signs everyone out, including people who ticked "Stay unlocked on this device".

## What this does and doesn't protect

- The home page's content is encrypted (AES-256, key from the password by PBKDF2 with 600,000 rounds), so it
  can't be read from the published page or from this repository without the password. A long password matters:
  anyone can download the locked page and guess at it for as long as they like.
- It locks **this page only**. Each tool is still at its own address, and the folders in this public repository
  are still listed on GitHub. Anyone who has a tool's address can open it without the password.
- Don't commit `home.html`, and don't put the password in any file in this repository.
- If `home.html` is lost, unlock the published page in a browser and copy the links back out.
