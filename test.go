///usr/bin/env go run "$0" "$@"; exit

package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Println("Go: Hello World.")

	os.Exit(1)
}
