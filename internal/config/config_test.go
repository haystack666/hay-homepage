package config

import (
	"testing"
	"time"
)

func clearConfigEnv(t *testing.T) {
	t.Helper()
	for _, name := range []string{
		"HAYSTACK_ENV", "HAYSTACK_ADDR", "HAYSTACK_DB_PATH", "HAYSTACK_WEB_DIST",
		"HAYSTACK_BASE_URL", "HAYSTACK_ADMIN_PASSWORD_HASH", "HAYSTACK_SESSION_TTL",
		"HAYSTACK_SECURE_COOKIES",
	} {
		t.Setenv(name, "")
	}
}

func TestLoadUsesDevelopmentDefaults(t *testing.T) {
	clearConfigEnv(t)
	config, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if config.Addr != "127.0.0.1:8080" || config.DBPath != "data/haystack.db" || config.DistDir != "web/dist" {
		t.Fatalf("defaults = %+v", config)
	}
	if config.BaseURL != "http://localhost:8080" || config.SessionTTL != 12*time.Hour || config.SecureCookies {
		t.Fatalf("runtime defaults = %+v", config)
	}
}

func TestLoadRejectsMissingProductionPasswordHash(t *testing.T) {
	clearConfigEnv(t)
	t.Setenv("HAYSTACK_ENV", "production")
	if _, err := Load(); err == nil {
		t.Fatal("expected production password hash error")
	}
}

func TestLoadParsesConfiguredValues(t *testing.T) {
	clearConfigEnv(t)
	t.Setenv("HAYSTACK_ENV", "production")
	t.Setenv("HAYSTACK_ADDR", "0.0.0.0:9000")
	t.Setenv("HAYSTACK_DB_PATH", "/srv/haystack.db")
	t.Setenv("HAYSTACK_WEB_DIST", "/srv/web")
	t.Setenv("HAYSTACK_BASE_URL", "https://haystack.example/")
	t.Setenv("HAYSTACK_ADMIN_PASSWORD_HASH", "hash")
	t.Setenv("HAYSTACK_SESSION_TTL", "30m")
	config, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if config.BaseURL != "https://haystack.example" || config.SessionTTL != 30*time.Minute || !config.SecureCookies {
		t.Fatalf("configured values = %+v", config)
	}
}
