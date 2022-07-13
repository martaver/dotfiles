#!/usr/bin/env bash

karabiner_config=~/.config/karabiner/karabiner.json
# yq "load(\"$karabiner_config\") *= {\"test\": 1}"
karabiner_windows_mode=$(curl https://raw.githubusercontent.com/rux616/karabiner-windows-mode/master/json/windows_shortcuts.json | yq -o=json '.rules')

shaped=$(echo "$karabiner_windows_mode" | yq -o=json '{"profiles": [{ "complex_modifications": { "rules": . } }]}')

cat $karabiner_config | \
yq -o=json ". *= $shaped" > test.json

# 
echo Done

arr1='[{"k": "1", "v": "one"},{"k": "2", "v": "two"}]'
arr2='[{"k": "1", "v": "ONE"},{"k": "3", "v": "foo"}]'


echo $arr1 | idPath=".a"  originalPath=".myArray"  otherPath=".newArray" yq eval-all '
(
  (( (eval(strenv(originalPath)) + eval(strenv(otherPath)))  | .[] | {(eval(strenv(idPath))):  .}) as $item ireduce ({}; . * $item )) as $uniqueMap
  | ( $uniqueMap  | to_entries | .[]) as $item ireduce([]; . + $item.value)
) as $mergedArray
| select(fi == 0) | (eval(strenv(originalPath))) = $mergedArray
' another.yml