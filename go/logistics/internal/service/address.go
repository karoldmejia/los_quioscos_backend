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

func (s *AddressService) CheckCoverage(ctx context.Context, pickupID string, deliveryID string) (bool, error) {
	kiosk, err := s.repo.Get(ctx, pickupID)
	if err != nil {
		return false, err
	}
	if kiosk == nil {
		log.Printf("Kiosk with %s ID does not have a default address", pickupID)
		return false, fmt.Errorf("kiosk %s does not have a default address", pickupID)
	}

	client, err := s.repo.Get(ctx, deliveryID)
	if err != nil {
		return false, fmt.Errorf("user %s does not have a default address", deliveryID)
	}
	if client == nil {
		log.Printf("User with %s ID does not a default address", deliveryID)
		return false, fmt.Errorf("user %s does not have a default address", pickupID)
	}

	covered, err := s.repo.CheckCoverage(ctx, pickupID, deliveryID)
	if err != nil {
		return false, fmt.Errorf("checking coverage: %w", err)
	}
	return covered, nil

}

func (s *AddressService) GetUserAddress(ctx context.Context, userID string) (*model.Address, error) {
	userAddress, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if userAddress == nil {
		log.Printf("User with %s ID does not have a default address", userID)
		return nil, fmt.Errorf("user %s does not have a default address", userID)
	}
	return userAddress, nil
}
