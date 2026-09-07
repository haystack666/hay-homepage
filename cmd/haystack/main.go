package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"hay-homepage/internal/auth"
	"hay-homepage/internal/config"
	"hay-homepage/internal/db"
	"hay-homepage/internal/httpapi"
	"hay-homepage/internal/notes"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	connection, err := db.Open(ctx, cfg.DBPath)
	if err != nil {
		return err
	}
	defer connection.Close()
	if err := db.Migrate(ctx, connection); err != nil {
		return err
	}

	verifier, err := auth.NewPasswordVerifier(cfg.AdminPasswordHash)
	if err != nil {
		return err
	}
	noteService := notes.NewService(notes.NewRepository(connection), time.Now)
	authManager := auth.NewManager(
		auth.NewSQLSessionStore(connection), verifier, time.Now, cfg.SessionTTL, cfg.SecureCookies,
	)
	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.NewRouter(httpapi.Dependencies{Notes: noteService, Auth: authManager, DistDir: cfg.DistDir, BaseURL: cfg.BaseURL}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdownContext)
	}
}
