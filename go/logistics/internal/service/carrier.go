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

type CarrierService struct {
	repo repository.CarrierRepository
}

func NewCarrierService(repo repository.CarrierRepository) *CarrierService {
	return &CarrierService{repo: repo}
}

func (s *CarrierService) HandleCarrierActivated(ctx context.Context, event events.CarrierActivatedEvent) error {
	existing, err := s.repo.Get(ctx, event.UserID)
	if err != nil {
		return err
	}
	if existing != nil {
		log.Printf("Carrier is already activated for %s", event.UserID)
		return nil
	}

	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return err
	}
	activatedAt, err := time.Parse(time.RFC3339, event.ActivatedAt)
	if err != nil {
		return fmt.Errorf("invalid updatedAt format: %w", err)
	}

	carrier := &model.Carrier{
		UserID:            userID,
		ServiceRadiusKm:   event.ServiceRadiusKm,
		BaseLatitude:      event.BaseLatitude,
		BaseLongitude:     event.BaseLongitude,
		IsAcceptingRoutes: event.IsAcceptingRoutes,
		ActivatedAt:       activatedAt,
	}
	if err := s.repo.Create(ctx, carrier); err != nil {
		return err
	}
	log.Printf("Carrier created with ID %s", event.UserID)
	return nil
}

func (s *CarrierService) HandleCarrierUpdated(ctx context.Context, event events.CarrierUpdatedEvent) error {
	existing, err := s.repo.Get(ctx, event.UserID)
	if err != nil {
		return err
	}
	if existing == nil {
		log.Printf("Carrier with %s ID does not exist", event.UserID)
		return nil
	}

	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return err
	}
	updatedAt, err := time.Parse(time.RFC3339, event.UpdatedAt)
	if err != nil {
		return fmt.Errorf("invalid updatedAt format: %w", err)
	}

	carrier := &model.Carrier{
		UserID:            userID,
		ServiceRadiusKm:   event.ServiceRadiusKm,
		IsAcceptingRoutes: event.IsAcceptingRoutes,
		UpdatedAt:         &updatedAt,
	}
	if err := s.repo.Update(ctx, carrier); err != nil {
		return err
	}
	log.Printf("Carrier updated with ID %s", event.UserID)
	return nil
}

func (s *CarrierService) HandleCarrierDeleted(ctx context.Context, event events.CarrierDeletedEvent) error {
	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return err
	}

	carrier := &model.Carrier{
		UserID: userID,
	}
	if err := s.repo.Delete(ctx, carrier); err != nil {
		return err
	}
	log.Printf("Carrier deleted with ID %s", event.UserID)
	return nil
}
