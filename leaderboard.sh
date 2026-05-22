#!/usr/bin/env bash
# leaderboard.sh — aggregate per-author git activity across repos.
#
# Usage:
#   leaderboard.sh [--from YYYY-MM] [--to YYYY-MM] PATH_OR_GLOB [PATH_OR_GLOB ...]
#
# Defaults to the last 12 months (inclusive of the current month).
# Writes leaderboard.csv next to this script. One row per author; for each
# month in the range we emit three columns: Commits, Edits, Branches.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="$SCRIPT_DIR/leaderboard.csv"

usage() {
  echo "usage: $0 [--from YYYY-MM] [--to YYYY-MM] PATH_OR_GLOB [PATH_OR_GLOB ...]" >&2
  exit 2
}

FROM=""
TO=""
positional=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --from) FROM=${2:-}; shift 2 ;;
    --to)   TO=${2:-};   shift 2 ;;
    --from=*) FROM=${1#*=}; shift ;;
    --to=*)   TO=${1#*=};   shift ;;
    -h|--help) usage ;;
    --) shift; positional+=("$@"); break ;;
    -*) echo "unknown flag: $1" >&2; usage ;;
    *) positional+=("$1"); shift ;;
  esac
done
[[ ${#positional[@]} -eq 0 ]] && usage

[[ -z "$TO" ]]   && TO=$(date +%Y-%m)
[[ -z "$FROM" ]] && FROM=$(date -j -v-11m -f '%Y-%m' "$TO" +%Y-%m)

[[ "$FROM" =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || { echo "invalid --from: $FROM (expected YYYY-MM)" >&2; exit 2; }
[[ "$TO"   =~ ^[0-9]{4}-(0[1-9]|1[0-2])$ ]] || { echo "invalid --to: $TO (expected YYYY-MM)" >&2; exit 2; }

# Bounds for filtering — git uses inclusive --since / exclusive --until.
SINCE_DATE="${FROM}-01"
UNTIL_YM=$(date -j -v+1m -f '%Y-%m' "$TO" +%Y-%m)
UNTIL_DATE="${UNTIL_YM}-01"

# Expand args (each may be a literal path or an unexpanded glob from a quoted arg).
shopt -s nullglob
candidates=()
for arg in "${positional[@]}"; do
  for path in $arg; do
    [[ -d "$path" ]] && candidates+=("$path")
  done
done
shopt -u nullglob

# Filter to git repos with a worktree, dedupe by remote URL.
declare -A seen_key
repos=()
for dir in "${candidates[@]}"; do
  if [[ "$(git -C "$dir" rev-parse --is-inside-work-tree 2>/dev/null)" != "true" ]]; then
    continue
  fi
  toplevel=$(git -C "$dir" rev-parse --show-toplevel)
  key=$(git -C "$dir" remote get-url origin 2>/dev/null || true)
  [[ -z "$key" ]] && key="path:$toplevel"
  if [[ -z "${seen_key[$key]:-}" ]]; then
    seen_key[$key]=1
    repos+=("$toplevel")
  fi
done

if [[ ${#repos[@]} -eq 0 ]]; then
  echo "no git repos found in given paths" >&2
  exit 1
fi

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
time_step() {
  local label=$1; shift
  local start=$SECONDS
  log "→ $label"
  "$@"
  log "✓ $label ($((SECONDS-start))s, ${SECONDS}s total)"
}

log "range: ${FROM} → ${TO} (inclusive)"
log "found ${#repos[@]} unique repo(s):"
for r in "${repos[@]}"; do log "    $r"; done

# Fetch remotes so commits and remote branches are up-to-date before counting.
# `git log --all` and the branch pass both read from refs/remotes/*, so
# without a fetch we'd miss anything pushed since the last local fetch.
# Failures (offline, no remotes, auth) shouldn't abort the run.
fetch_repos() {
  for repo in "${repos[@]}"; do
    local repo_start=$SECONDS
    if git -C "$repo" fetch --all --prune --quiet 2>/dev/null; then
      log "    $repo: $((SECONDS-repo_start))s"
    else
      log "    $repo: fetch failed (continuing with local refs)"
    fi
  done
}
time_step "git: fetch --all --prune per repo" fetch_repos

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Commits + edits per (author, month). Walks every ref (refs/heads AND
# refs/remotes) via `--all`, deduping commits reachable from multiple refs.
# We don't use gitql for commits here: its `commits` table doesn't include
# remote-only refs, so commits fetched from remotes wouldn't be counted.
collect_stats() {
  : > "$TMP/stats.tsv"
  for repo in "${repos[@]}"; do
    local repo_start=$SECONDS
    git -C "$repo" log --all --no-merges \
        --since="$SINCE_DATE" --until="$UNTIL_DATE" \
        --pretty=$'\x01%aN\t%aI' --numstat \
      | awk -F'\t' '
          /^\x01/ {
            sub(/^\x01/, "", $0)
            split($0, hdr, "\t")
            author = hdr[1]
            month  = substr(hdr[2], 1, 7)
            commits[author SUBSEP month]++
            next
          }
          NF == 3 && $1 != "-" && $2 != "-" {
            edits[author SUBSEP month] += $1 + $2
          }
          END {
            for (k in commits) {
              split(k, p, SUBSEP)
              print p[1] "\t" p[2] "\t" commits[k] "\t" (edits[k]+0)
            }
          }' >> "$TMP/stats.tsv"
    log "    $repo: $((SECONDS-repo_start))s"
  done
  log "    stats.tsv: $(wc -l <"$TMP/stats.tsv") rows"
}
time_step "git: collect (author, month) commits+edits per repo" collect_stats

# Distinct branches per (author, month). For each ref, emit unique
# (author, month) tuples — python counts distinct refs per (author, month).
collect_branches() {
  : > "$TMP/branches.tsv"
  for repo in "${repos[@]}"; do
    local repo_start=$SECONDS
    local n_refs=0
    while IFS= read -r ref; do
      [[ -z "$ref" ]] && continue
      n_refs=$((n_refs+1))
      git -C "$repo" log "$ref" --no-merges \
          --since="$SINCE_DATE" --until="$UNTIL_DATE" \
          --format=$'%aN\t%aI' \
        | awk -F'\t' -v repo="$repo" -v ref="$ref" \
            'NF>=2 { print repo "\t" ref "\t" $1 "\t" substr($2,1,7) }' \
        | sort -u >> "$TMP/branches.tsv"
    done < <(git -C "$repo" for-each-ref --format='%(refname)' refs/heads refs/remotes)
    log "    $repo: $n_refs refs in $((SECONDS-repo_start))s"
  done
  log "    branches.tsv: $(wc -l <"$TMP/branches.tsv") rows"
}
time_step "git: collect (author, month, branch) tuples per repo" collect_branches

log "→ python: pivot to CSV"
python3 - "$TMP" "$OUTPUT" "$FROM" "$TO" <<'PY'
import csv, sys, collections, pathlib

tmp = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
from_ym, to_ym = sys.argv[3], sys.argv[4]

def month_iter(start_ym, end_ym):
    sy, sm = map(int, start_ym.split("-"))
    ey, em = map(int, end_ym.split("-"))
    y, m = sy, sm
    while (y, m) <= (ey, em):
        yield f"{y:04d}-{m:02d}"
        m = 1 if m == 12 else m + 1
        if m == 1:
            y += 1

months = list(month_iter(from_ym, to_ym))
months_desc = list(reversed(months))

commits = collections.defaultdict(lambda: collections.defaultdict(int))
edits   = collections.defaultdict(lambda: collections.defaultdict(int))
branch_sets = collections.defaultdict(set)
authors = set()

with (tmp / "stats.tsv").open() as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 4:
            continue
        author, mo, c, e = parts
        commits[author][mo] += int(c)
        edits[author][mo]   += int(e)
        authors.add(author)

with (tmp / "branches.tsv").open() as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 4:
            continue
        repo, ref, author, mo = parts
        branch_sets[(author, mo)].add((repo, ref))
        authors.add(author)

header = ["Author"]
for mo in months_desc:
    header += [f"{mo} Commits", f"{mo} Edits", f"{mo} Branches"]

with out.open("w", newline="") as f:
    w = csv.writer(f)
    w.writerow(header)
    for author in sorted(authors, key=lambda s: s.lower()):
        row = [author]
        for mo in months_desc:
            row.append(commits[author].get(mo, 0))
            row.append(edits[author].get(mo, 0))
            row.append(len(branch_sets.get((author, mo), ())))
        w.writerow(row)

print(f"wrote {out}", file=sys.stderr)
PY
