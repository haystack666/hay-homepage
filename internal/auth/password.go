package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidPassword = errors.New("invalid password")

type PasswordVerifier struct {
	hash []byte
}

func NewPasswordVerifier(hash string) (*PasswordVerifier, error) {
	if hash == "" {
		return nil, errors.New("admin password hash is required")
	}
	if _, err := bcrypt.Cost([]byte(hash)); err != nil {
		return nil, errors.New("admin password hash is invalid")
	}
	return &PasswordVerifier{hash: []byte(hash)}, nil
}

func (p *PasswordVerifier) Verify(password string) error {
	if err := bcrypt.CompareHashAndPassword(p.hash, []byte(password)); err != nil {
		return ErrInvalidPassword
	}
	return nil
}
