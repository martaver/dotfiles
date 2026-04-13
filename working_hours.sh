#!/bin/bash

BASE=~/holvi/
EMAIL="snemeth@holvi.com"
MONTH="now"

for arg in "$@"; do
  case "$arg" in
    --committer_email=*) EMAIL="${arg#*=}" ;;
    --month=*) MONTH="${arg#*=}" ;;
  esac
done

case "$MONTH" in
  now)  MONTH_START=$(date +%Y-%m-01) ;;
  last) MONTH_START=$(date -v-1m +%Y-%m-01) ;;
  *)    MONTH_START="${MONTH}-01" ;;
esac

FROM="$MONTH_START 00:00:00"
TO="$(date -j -v+1m -f %Y-%m-%d "$MONTH_START" +%Y-%m-01) 00:00:00"

gitql -o json -r $BASE* -q "
SELECT
  DATE(datetime) as Date,
  MIN(datetime) as StartTime,
  MAX(datetime) as EndTime,
  ARRAY_AGG(REPLACE(REPLACE(repo, '$BASE', ''), '/.git', '')) as Repos
FROM
  commits
WHERE
  committer_email = '$EMAIL'
  AND datetime >= '$FROM'
  AND datetime <= '$TO'
GROUP BY
  DATE(datetime)
ORDER BY
  DATE(datetime)
" | jq -r '
  .[] |
  (.repos | ltrimstr("[") | rtrimstr("]") | split(", ") | unique | join(", ")) as $repos |
  "\(.date)  \(.starttime | split(" ")[1] | split(".")[0])  \(.endtime | split(" ")[1] | split(".")[0])  [\($repos)]"
'