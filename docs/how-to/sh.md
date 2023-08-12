# zsh

## Test regex
Positive:
```sh
if [[ "$value" =~ '^regex$' ]]
then
    # ...
fi
```

Negative:
```sh
if ! [[ "$value" =~ '^regex$' ]]
then
    # ...
fi
```