package config

import (
	"errors"
	"os"
	"strings"
	"time"
)

type Config struct {
	Addr              string
	DBPath            string
	DistDir           string
	BaseURL           string
	AdminPasswordHash string
	SessionTTL        time.Duration
	SecureCookies     bool
}

func Load() (Config, error) {
	environment := strings.ToLower(strings.TrimSpace(os.Getenv("HAYSTACK_ENV")))
	if environment == "" {
		environment = "development"
	}
	addr := envOrDefault("HAYSTACK_ADDR", "127.0.0.1:8080")
	dbPath := envOrDefault("HAYSTACK_DB_PATH", "data/haystack.db")
	distDir := envOrDefault("HAYSTACK_WEB_DIST", "web/dist")
	baseURL := strings.TrimRight(envOrDefault("HAYSTACK_BASE_URL", "http://localhost:8080"), "/")
	passwordHash := strings.TrimSpace(os.Getenv("HAYSTACK_ADMIN_PASSWORD_HASH"))
	if environment == "production" && passwordHash == "" {
		return Config{}, errors.New("HAYSTACK_ADMIN_PASSWORD_HASH is required in production")
	}

	sessionTTL := 12 * time.Hour
	if raw := strings.TrimSpace(os.Getenv("HAYSTACK_SESSION_TTL")); raw != "" {
		parsed, err := time.ParseDuration(raw)
		if err != nil || parsed <= 0 {
			return Config{}, errors.New("HAYSTACK_SESSION_TTL must be a positive duration")
		}
		sessionTTL = parsed
	}

	secureCookies := environment == "production"
	if raw := strings.TrimSpace(os.Getenv("HAYSTACK_SECURE_COOKIES")); raw != "" {
		secureCookies = raw == "1" || strings.EqualFold(raw, "true")
	}

	return Config{
		Addr:              addr,
		DBPath:            dbPath,
		DistDir:           distDir,
		BaseURL:           baseURL,
		AdminPasswordHash: passwordHash,
		SessionTTL:        sessionTTL,
		SecureCookies:     secureCookies,
	}, nil
}

func envOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
