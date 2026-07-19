#!/usr/bin/env bash
# .agents/tools/archive-epic.sh
# Mechanical spine of the archive-epic skill (Package-Scoped Knowledge
# Filtering ADR; plan .agents/changelogs/agentic/plan/…AGN06…, §4, ST04).
#
# It sequences the existing archive tools (epic-commit-range,
# domains-from-diff, archive-append, backfill-compact-pr-info, archive-check)
# against `index.json` and the central reference files. It NEVER commits,
# NEVER writes KNOWLEDGE.md prose, and NEVER invents a ryoiki or a blacklist
# entry on its own (Golden Rule 3) — `confirm`/`blacklist` only ever apply
# what a human has already approved; they never run unattended and never pick
# a ryoiki or exclusion themselves.
#
# Draft entries are written directly to `index.json` (not through the strict
# `archive-append` path, which stays for confirmed entries) so they can carry
# an unconfirmed `state` field. They live only in the working tree — the git
# diff of index.json IS the review surface (§4, no hidden worksheet). Nothing
# forces them to be resolved before the next command; `verify` refuses to run
# archive-check.sh while any are left lying around, since a stray draft's
# `state` field is not schema-legal.
#
# Steps (§4 of the plan):
#   discover   resolve commit range + route to touched units, read-only
#   draft      write each story to index.json as facts + suggested ryoiki + state:"draft"
#   status     list an epic's index entries split into draft vs confirmed
#   confirm    apply human-approved renames + delete state for an epic's drafts (bulk-accept)
#   blacklist  append human-approved ryoiki exclusions to a unit's blacklist entry
#   scaffold   print a unit's confirmed, non-blacklisted ryoiki as a `##` heading skeleton
#   check      confirmed, non-blacklisted index ryoiki ⊆ `##` headings in the unit's doc
#   verify     archive-check.sh + check (refuses if any draft entries remain)
#   backfill   scan index.json for compact_pr: null and try to resolve it (report only)
#   compact    print the git rm -r + commit + archive-append commands (human runs them)
#
# Usage:
#   archive-epic.sh discover EP## [--range "<sha>^ <sha>"]
#   archive-epic.sh draft EP## [--range "<sha>^ <sha>"]
#   archive-epic.sh status EP##
#   archive-epic.sh confirm EP## [--data -]   # JSON array of {id, ryoiki?} renames on stdin
#   archive-epic.sh blacklist <apps/foo|packages/bar> --add ryoiki1,ryoiki2
#   archive-epic.sh scaffold <apps/foo|packages/bar>
#   archive-epic.sh check
#   archive-epic.sh verify
#   archive-epic.sh backfill
#   archive-epic.sh compact EP##
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$DIR" rev-parse --show-toplevel 2>/dev/null || pwd)"
INDEX="$ROOT/.agents/changelogs/archive/index.json"
BLACKLIST="$ROOT/.agents/reference/ryoiki-blacklist.json"
CHANGELOGS_DIR="$ROOT/.agents/changelogs"

die() { echo "error: $*" >&2; exit 1; }
need_jq() { command -v jq >/dev/null 2>&1 || die "jq is required"; }
need_jq

need_index() { [[ -f "$INDEX" ]] || die "no archive index at $INDEX"; }

# blacklist entries for a unit: the reserved "*" global entry plus the unit's
# own entry, deduped ([] if the file is absent or both keys are absent, D5).
blacklist_for() {
  local unit="$1"
  [[ -f "$BLACKLIST" ]] || { echo "[]"; return; }
  jq --arg u "$unit" '((.["*"] // []) + (.[$u] // [])) | unique' "$BLACKLIST"
}

# is ryoiki $1 excluded by blacklist entry $2 (exact or path-prefix, D6)?
excluded_by() { [[ "$1" == "$2" || "$1" == "$2"/* ]]; }

# ── headings of a KNOWLEDGE.md, one per line, heading text only ─────────────
knowledge_headings() {
  local f="$1"; [[ -f "$f" ]] || return 0
  sed -n 's/^## \(.*\)/\1/p' "$f"
}

# ── resolve a commit range for an epic: --range override, else
#    epic-commit-range.sh. Prints two lines: STATUS and RANGE ("first^ last"). ─
resolve_range() {
  local ep="$1" override="$2"
  if [[ -n "$override" ]]; then
    echo "firm"
    echo "$override"
    return
  fi
  local out status range
  out="$("$DIR/epic-commit-range.sh" "$ep")"
  status="$(sed -n 's/^status: //p' <<<"$out")"
  case "$status" in
    firm)
      range="$(sed -n 's/^suggested_diff_range: //p' <<<"$out")"
      echo "firm"
      echo "$range"
      ;;
    indeterminate)
      echo "$out" >&2
      die "range is indeterminate for $ep — investigate the flags/candidates above, then re-run with --range \"<sha>^ <sha>\""
      ;;
    not_found)
      die "no commits reference ${ep}'s changelog folder — confirm the epic id"
      ;;
    *)
      die "epic-commit-range.sh returned unrecognised status: $status"
      ;;
  esac
}

cmd_discover() {
  local ep="${1:?usage: discover EP## [--range ...]}"; shift || true
  local override=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --range)
        if [[ $# -ge 3 && "$3" != --* ]]; then override="$2 $3"; shift 3
        else override="$2"; shift 2
        fi
        ;;
      *) die "discover: unknown argument: $1" ;;
    esac
  done
  local out status range first last
  out="$(resolve_range "$ep" "$override")" || exit 1
  status="$(head -1 <<<"$out")"; range="$(tail -1 <<<"$out")"
  read -r first last <<<"$range"
  echo "epic: $ep"
  echo "status: $status"
  echo "range: $first $last"
  echo "units:"
  "$DIR/domains-from-diff.sh" "$first" "$last" | sed 's/^/  - /'
}

# story JSON facts for one changelog file (jq -n object, on stdout).
draft_story_json() {
  local ep="$1" file="$2" log_range_first="$3" log_range_last="$4"
  local base id title slug domain completed pr

  base="$(basename "$file" .md)"
  # Try to find the epic-prefixed pattern first (e.g., EP01-ST03)
  id="$(grep -oE "${ep}-[A-Z]+[0-9]+" <<<"$base" | head -1)"
  # Fall back to bare story ID pattern (ST##, DS##) and prepend the epic
  if [[ -z "$id" ]]; then
    local bare_id
    bare_id="$(grep -oE '[A-Z]+[0-9]+' <<<"$base" | grep -E '^(ST|DS)[0-9]+' | head -1)"
    [[ -n "$bare_id" ]] && id="${ep}-${bare_id}"
  fi
  [[ -z "$id" ]] && { echo "warn: skipping $file — no ${ep}-XX## or XX## id in filename" >&2; return 1; }

  title="$(grep -m1 '^# ' "$file" | sed -E "s/^# (${id}: )?//")"
  [[ -z "$title" ]] && title="$id"

  slug="$(sed -E "s/^[0-9TZ]+-//; s/^${id}-//" <<<"$base")"

  domain="$(grep -oE '`(apps|packages)/[A-Za-z0-9_-]+' "$file" 2>/dev/null \
    | tr -d '`' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')"
  [[ -z "$domain" ]] && domain="<non-workspace>"

  completed="$(git -C "$ROOT" log --format=%ad --date=short -1 \
    "${log_range_first}..${log_range_last}" -- "$file" 2>/dev/null || true)"
  [[ -z "$completed" ]] && completed="$(git -C "$ROOT" log --format=%ad --date=short -1 \
    "${log_range_first}..${log_range_last}" 2>/dev/null || true)"
  [[ -z "$completed" ]] && completed="$(date +%F)"

  pr="$(git -C "$ROOT" log -1 --format=%s "$log_range_last" 2>/dev/null \
    | grep -oE '#[0-9]+' | head -1 | tr -d '#' || true)"

  local summary
  summary="$(awk '
    /^## Summary[[:space:]]*$/ || /^## What changed[[:space:]]*$/ { flag=1; next }
    flag && /^## / { exit }
    flag && /^---/ { exit }
    flag { print }
  ' "$file" | sed '/^[[:space:]]*$/d' | tr '\n' ' ' | sed -E 's/  +/ /g; s/ +$//')"
  [[ -z "$summary" ]] && summary="TODO: summarize — see ${file#"$ROOT"/}"

  jq -n \
    --arg id "$id" --arg epic "$ep" --arg title "$title" --arg domain "$domain" \
    --arg ryoiki "$slug" --arg completed "$completed" --arg summary "$summary" \
    --argjson pr "${pr:-null}" \
    '{
      id: $id, epic: $epic, track: "project", title: $title, domain: $domain,
      ryoiki: $ryoiki, completed: $completed, duration: "undetermined",
      summary: $summary, supersedes: [], fixes: [], pr: $pr, compact_pr: null,
      state: "draft"
    }'
}

cmd_draft() {
  local ep="${1:?usage: draft EP## [--range ...]}"; shift || true
  local override=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --range)
        if [[ $# -ge 3 && "$3" != --* ]]; then override="$2 $3"; shift 3
        else override="$2"; shift 2
        fi
        ;;
      *) die "draft: unknown argument: $1" ;;
    esac
  done
  need_index

  local out range first last
  out="$(resolve_range "$ep" "$override")" || exit 1
  range="$(tail -1 <<<"$out")"
  read -r first last <<<"$range"

  local folder
  folder="$(find "$CHANGELOGS_DIR" -maxdepth 1 -type d -name "${ep}--*" | head -1)"
  [[ -z "$folder" ]] && die "no ${ep}--*/ folder under $CHANGELOGS_DIR"

  local tmp_drafts
  tmp_drafts="$(mktemp)"
  trap 'rm -f "$tmp_drafts"' RETURN

  local n=0
  while IFS= read -r file; do
    if draft_story_json "$ep" "$file" "$first" "$last" >>"$tmp_drafts"; then
      n=$((n + 1))
    fi
  done < <(find "$folder" -maxdepth 1 -name '*.md' | sort)

  [[ $n -eq 0 ]] && die "no drafts produced from $folder"

  local drafts_json
  drafts_json="$(jq -s '.' "$tmp_drafts")"

  local tmp_out
  tmp_out="$(mktemp)"
  jq --argjson drafts "$drafts_json" '
    (.stories | map(.id)) as $ids
    | reduce $drafts[] as $d (
        {index: ., skipped: []};
        ($ids | index($d.id)) as $i
        | if $i != null and ((.index.stories[$i] | has("state")) | not) then
            .skipped += [$d.id]
          elif $i != null then
            .index.stories[$i] = $d
          else
            .index.stories += [$d]
          end
      )
    | .index.stories |= sort_by(.completed)
    | {index: .index, skipped: .skipped}
  ' "$INDEX" >"$tmp_out"

  local skipped
  skipped="$(jq -r '.skipped[]' "$tmp_out" 2>/dev/null || true)"
  jq '.index' "$tmp_out" >"$INDEX.new"
  mv "$INDEX.new" "$INDEX"
  rm -f "$tmp_out"

  echo "✓ drafted ${n} stor(y/ies) from ${folder#"$ROOT"/}"
  if [[ -n "$skipped" ]]; then
    echo "  already confirmed, left untouched:"
    sed 's/^/    - /' <<<"$skipped"
  fi
  echo "Review + correct 'ryoiki' (and anything else) in the index.json diff, then delete each entry's \"state\" line to confirm."
}

cmd_status() {
  local ep="${1:?usage: status EP##}"
  need_index
  echo "epic: $ep"
  echo "confirmed:"
  jq -r --arg ep "$ep" '.stories[] | select(.epic == $ep and (has("state") | not)) | "  - \(.id)  domain=\(.domain)  ryoiki=\(.ryoiki)"' "$INDEX"
  echo "draft:"
  jq -r --arg ep "$ep" '.stories[] | select(.epic == $ep and has("state")) | "  - \(.id)  domain=\(.domain)  ryoiki=\(.ryoiki)  state=\(.state)"' "$INDEX"
}

# apply an already-approved decision: rename (optional, via --data) + delete
# `state` for every draft entry of $ep. This never runs unattended — the
# calling skill only invokes it after a human has reviewed the full draft
# list (status) and given explicit approval, per story, in conversation.
cmd_confirm() {
  local ep="${1:?usage: confirm EP## [--data -]}"; shift || true
  local data=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --data) data="${2:?--data requires a path or -}"; shift 2 ;;
      *) die "confirm: unknown argument: $1" ;;
    esac
  done
  need_index

  local overrides
  if [[ -n "$data" ]]; then
    if [[ "$data" == "-" ]]; then overrides="$(cat)"; else overrides="$(cat "$data")"; fi
    jq -e 'type == "array" and all(.[]; has("id"))' >/dev/null 2>&1 <<<"$overrides" \
      || die "confirm: --data must be a JSON array of {id, ryoiki?} objects"
  else
    overrides="[]"
  fi

  local tmp
  tmp="$(mktemp)"
  jq --arg ep "$ep" --argjson overrides "$overrides" '
    ($overrides | map(select(.ryoiki != null) | {(.id): .ryoiki}) | add // {}) as $renames
    | .stories |= map(
        if .epic == $ep and has("state") then
          (if ($renames[.id] // null) != null then .ryoiki = $renames[.id] else . end)
          | del(.state)
        else . end
      )
  ' "$INDEX" >"$tmp"
  mv "$tmp" "$INDEX"

  local n
  n="$(jq --arg ep "$ep" '[.stories[] | select(.epic == $ep and (has("state") | not))] | length' "$INDEX")"
  echo "✓ confirmed all draft entries for ${ep} (${n} confirmed total for this epic)"
}

# append human-approved exclusions to a unit's blacklist entry (dedup, sorted).
cmd_blacklist() {
  local unit="${1:?usage: blacklist <apps/foo|packages/bar> --add r1,r2,...}"; shift || true
  local add=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --add) add="${2:?--add requires a comma-separated list}"; shift 2 ;;
      *) die "blacklist: unknown argument: $1" ;;
    esac
  done
  [[ -z "$add" ]] && die "blacklist: --add <ryoiki1,ryoiki2,...> is required"
  [[ -f "$BLACKLIST" ]] || echo '{}' >"$BLACKLIST"

  local additions
  additions="$(jq -R 'split(",") | map(select(length > 0))' <<<"$add")"

  local tmp
  tmp="$(mktemp)"
  jq --arg u "$unit" --argjson add "$additions" '
    .[$u] = ((.[$u] // []) + $add | unique | sort)
  ' "$BLACKLIST" >"$tmp"
  mv "$tmp" "$BLACKLIST"
  echo "✓ ${unit} blacklist is now: $(jq -c --arg u "$unit" '.[$u]' "$BLACKLIST")"
}

cmd_scaffold() {
  local unit="${1:?usage: scaffold <apps/foo|packages/bar>}"
  need_index
  local blacklist confirmed
  blacklist="$(blacklist_for "$unit")"
  confirmed="$(jq -r --arg u "$unit" '.stories[] | select(.domain == $u and (has("state") | not)) | .ryoiki' "$INDEX" | sort -u)"

  echo "---"
  echo "unit: $unit"
  echo "sources: []"
  echo "updated: $(date +%F)"
  echo "---"
  echo
  while IFS= read -r ryoiki; do
    [[ -z "$ryoiki" ]] && continue
    local excluded=0
    while IFS= read -r bl; do
      [[ -z "$bl" ]] && continue
      excluded_by "$ryoiki" "$bl" && { excluded=1; break; }
    done < <(jq -r '.[]' <<<"$blacklist")
    [[ $excluded -eq 0 ]] && echo "## $ryoiki"
  done <<<"$confirmed"
}

cmd_check() {
  need_index
  local units
  units="$(jq -r '.stories[] | select(has("state") | not) | .domain' "$INDEX" | grep -E '^(apps|packages)/' | sort -u)"

  local fail=0
  while IFS= read -r unit; do
    [[ -z "$unit" ]] && continue
    local blacklist confirmed doc headings
    blacklist="$(blacklist_for "$unit")"
    confirmed="$(jq -r --arg u "$unit" '.stories[] | select(.domain == $u and (has("state") | not)) | .ryoiki' "$INDEX" | sort -u)"
    doc="$ROOT/$unit/KNOWLEDGE.md"
    headings="$(knowledge_headings "$doc")"

    while IFS= read -r ryoiki; do
      [[ -z "$ryoiki" ]] && continue
      local excluded=0
      while IFS= read -r bl; do
        [[ -z "$bl" ]] && continue
        excluded_by "$ryoiki" "$bl" && { excluded=1; break; }
      done < <(jq -r '.[]' <<<"$blacklist")
      if [[ $excluded -eq 1 ]]; then
        continue  # legitimately headless (D9)
      fi
      if ! grep -qxF "$ryoiki" <<<"$headings"; then
        echo "✗ $unit: confirmed ryoiki \"$ryoiki\" has no \"## $ryoiki\" heading in ${doc#"$ROOT"/}" >&2
        fail=1
      fi
    done <<<"$confirmed"
  done <<<"$units"

  if [[ $fail -eq 0 ]]; then
    echo "✓ check: confirmed ryoiki ⊆ ## headings, for every unit"
  fi
  return $fail
}

cmd_verify() {
  need_index
  local drafts
  drafts="$(jq -r '.stories[] | select(has("state")) | .id' "$INDEX")"
  if [[ -n "$drafts" ]]; then
    echo "✗ verify: unconfirmed draft entries remain in index.json — confirm (delete \"state\") or discard before verifying:" >&2
    sed 's/^/  - /' <<<"$drafts" >&2
    return 1
  fi
  "$DIR/archive-check.sh"
  cmd_check
}

cmd_backfill() {
  need_index
  local epics
  epics="$(jq -r '.stories[] | select(.compact_pr == null) | .epic' "$INDEX" | sort -u)"
  if [[ -z "$epics" ]]; then
    echo "✓ backfill: no stories with compact_pr: null"
    return 0
  fi
  while IFS= read -r ep; do
    [[ -z "$ep" ]] && continue
    local pr
    pr="$("$DIR/backfill-compact-pr-info.sh" "$ep")"
    echo "$ep: compact_pr=$pr"
  done <<<"$epics"
}

cmd_compact() {
  local ep="${1:?usage: compact EP##}"
  need_index
  local folder
  folder="$(find "$CHANGELOGS_DIR" -maxdepth 1 -type d -name "${ep}--*" | head -1)"
  [[ -z "$folder" ]] && die "no ${ep}--*/ folder under $CHANGELOGS_DIR — already compacted?"

  local domains title
  domains="$(jq -c --arg ep "$ep" '[.stories[] | select(.epic == $ep and (has("state") | not)) | .domain] | unique' "$INDEX")"
  title="$(jq -r --arg ep "$ep" '.epics[$ep].title // empty' "$INDEX")"
  [[ -z "$title" ]] && title="$(grep -m1 -h '^# ' "$ROOT/.agents/plans/epics/${ep}"-*.md 2>/dev/null | sed -E 's/^# EP[0-9]+[[:space:]]*[:—-][[:space:]]*//')"
  [[ -z "$title" ]] && title="TODO: epic title"

  local epic_data
  epic_data="$(jq -n --arg title "$title" --argjson domains "$domains" --arg archived "$(date +%F)" \
    '{title: $title, domains: $domains, archived: $archived}')"

  echo "# Run these once the epic's PR is merged to main and all its stories are confirmed:"
  echo
  echo "echo '$epic_data' | $DIR/archive-append.sh --epic ${ep} --data -"
  echo "git rm -r ${folder#"$ROOT"/}"
  echo "git commit -m \"docs(archive): compact ${ep}\""
}

# ── dispatch ─────────────────────────────────────────────────────────────────
SUBCOMMAND="${1:-}"; shift || true
case "$SUBCOMMAND" in
  discover)  cmd_discover "$@" ;;
  draft)     cmd_draft "$@" ;;
  status)    cmd_status "$@" ;;
  confirm)   cmd_confirm "$@" ;;
  blacklist) cmd_blacklist "$@" ;;
  scaffold)  cmd_scaffold "$@" ;;
  check)     cmd_check "$@" ;;
  verify)    cmd_verify "$@" ;;
  backfill)  cmd_backfill "$@" ;;
  compact)   cmd_compact "$@" ;;
  *)
    die "usage: archive-epic.sh {discover|draft|status|confirm|blacklist|scaffold|check|verify|backfill|compact} ..."
    ;;
esac
