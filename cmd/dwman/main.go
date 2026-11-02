package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	"dwman/internal/backend"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		port := os.Getenv("HTTP_PORT")
		if port == "" {
			port = os.Getenv("UVICORN_PORT")
		}
		if port == "" {
			port = "8000"
		}
		client := &http.Client{Timeout: 3 * time.Second}
		response, err := client.Get("http://127.0.0.1:" + port + "/health")
		if err != nil {
			os.Exit(1)
		}
		response.Body.Close()
		if response.StatusCode != 200 {
			os.Exit(1)
		}
		return
	}
	if err := backend.Run(); err != nil {
		fmt.Fprintln(os.Stderr, "dwman:", err)
		os.Exit(1)
	}
}
