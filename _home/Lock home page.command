#!/bin/bash
# Rebuilds the password-protected home page (../index.html) from home.html.
# Double-click this file in Finder, or run:  bash "_home/Lock home page.command"
#
# home.html is encrypted with AES-256; the key comes from your password
# (PBKDF2, SHA-256, 600,000 rounds). Only the encrypted page is published.
# Nothing is sent anywhere and the password is not saved.

ITERATIONS=600000   # must match lock-template.html
cd "$(dirname "$0")" || exit 1

fail() { echo; echo "Stopped: $1"; echo; exit 1; }

[ -f home.html ] || fail "home.html is missing from this folder."
[ -f lock-template.html ] || fail "lock-template.html is missing from this folder."
[ "$(head -n 1 home.html | tr -d '\r')" = "<!-- staff-home -->" ] || fail "the first line of home.html must be exactly: <!-- staff-home -->"
grep -q '^__PAYLOAD__$' lock-template.html || fail "lock-template.html has lost its __PAYLOAD__ line."

if [ -z "${STAFF_PW:-}" ]; then
  echo "Lock the staff home page"
  echo "Choose the password staff will type (12 or more characters; a few random words works well)."
  echo "Nothing shows while you type."
  echo
  read -r -s -p "Password: " STAFF_PW; echo
  read -r -s -p "Again:    " AGAIN; echo
  [ "$STAFF_PW" = "$AGAIN" ] || fail "the two passwords did not match. Nothing was changed."
fi
[ "${#STAFF_PW}" -ge 12 ] || fail "use at least 12 characters. Nothing was changed."
export STAFF_PW

PAYLOAD=$(openssl enc -aes-256-cbc -pbkdf2 -iter "$ITERATIONS" -md sha256 -salt \
            -pass env:STAFF_PW -in home.html -base64 -A 2>/dev/null)
[ -n "$PAYLOAD" ] || fail "this computer's openssl could not encrypt the page (it may be too old). Nothing was changed."

TMP=$(mktemp ./.index.XXXXXX) || fail "could not write in this folder."
{
  sed '/^__PAYLOAD__$/,$d' lock-template.html
  printf '%s\n' "$PAYLOAD"
  sed '1,/^__PAYLOAD__$/d' lock-template.html
} > "$TMP"
grep -q 'U2FsdGVkX1' "$TMP" || { rm -f "$TMP"; fail "the page did not build properly. Nothing was changed."; }
chmod 644 "$TMP"
mv -f "$TMP" ../index.html || fail "could not replace index.html."
unset STAFF_PW AGAIN

echo
echo "Done. index.html is now the locked page."
echo "Next: commit and push the Tools repository (GitHub Desktop) to publish it."
echo
