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

type VehicleService struct {
	repo repository.VehicleRepository
}

func NewVehicleService(repo repository.VehicleRepository) *VehicleService {
	return &VehicleService{repo: repo}
}

func (s *VehicleService) HandleVehicleUpsert(ctx context.Context, event events.VehicleUpsertEvent) error {
	vehicleID, err := uuid.Parse(event.VehicleID)
	if err != nil {
		return err
	}
	carrierID, err := uuid.Parse(event.CarrierID)
	if err != nil {
		return err
	}
	updatedAt, err := time.Parse(time.RFC3339, event.UpdatedAt)
	if err != nil {
		return fmt.Errorf("invalid updatedAt format: %w", err)
	}

	vehicle := &model.Vehicle{
		VehicleID:            vehicleID,
		CarrierID:            carrierID,
		MaxWeightKg:          event.MaxWeightKg,
		AcceptedPackageTypes: event.AcceptedPackageTypes,
		UpdatedAt:            updatedAt,
	}
	if err := s.repo.Upsert(ctx, vehicle); err != nil {
		return err
	}
	log.Printf("Vehicle upserted with ID %s", event.VehicleID)
	return nil
}

func (s *VehicleService) HandleVehicleDeleted(ctx context.Context, event events.VehicleDeletedEvent) error {
	vehicleID, err := uuid.Parse(event.VehicleID)
	if err != nil {
		return err
	}

	vehicle := &model.Vehicle{
		VehicleID: vehicleID,
	}
	if err := s.repo.Delete(ctx, vehicle); err != nil {
		return err
	}
	log.Printf("Vehicle deleted with ID %s", event.VehicleID)
	return nil
}
