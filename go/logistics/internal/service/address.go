package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
)

type AddressService struct {
	repo repository.AddressRepository
}

func NewAddressService(repo repository.AddressRepository) *AddressService {
	return &AddressService{repo: repo}
}

func (s *AddressService) HandleAddressUpdated(ctx context.Context, event events.AddressUpdated) error {
	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return err
	}
	changedAt, err := time.Parse(time.RFC3339, event.ChangedAt)
	if err != nil {
		return fmt.Errorf("invalid updatedAt format: %w", err)
	}

	address := &model.Address{
		UserID:          userID,
		Role:            event.Role,
		Latitude:        event.Latitude,
		Longitude:       event.Longitude,
		ServiceRadiusKm: &event.ServiceRadiusKm,
		ChangedAt:       changedAt,
	}
	if err := s.repo.Upsert(ctx, address); err != nil {
		return err
	}
	log.Printf("Address upserted with UserID %s", event.UserID)
	return nil
}
