//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/service"
)

func TestVehicleService_UpsertCreatesVehicle(t *testing.T) {
	testDB.Exec("TRUNCATE vehicles CASCADE")

	carrierRepo := repository.NewCarrierRepository(testDB)
	carrierSvc := service.NewCarrierService(carrierRepo)

	carrierID := uuid.New()
	if err := carrierSvc.HandleCarrierActivated(context.Background(), events.CarrierActivatedEvent{
		UserID:            carrierID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(4.711),
		BaseLongitude:     decimal.NewFromFloat(-74.0721),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup carrier failed: %v", err)
	}
	repo := repository.NewVehicleRepository(testDB)
	svc := service.NewVehicleService(repo)

	vehicleID := uuid.New()

	event := events.VehicleUpsertEvent{
		VehicleID:            vehicleID.String(),
		CarrierID:            carrierID.String(),
		MaxWeightKg:          decimal.NewFromFloat(1500.0),
		AcceptedPackageTypes: []model.PackageType{"BOX", "BAG"},
		UpdatedAt:            "2026-10-09T12:00:00Z",
	}

	if err := svc.HandleVehicleUpsert(context.Background(), event); err != nil {
		t.Fatalf("HandleVehicleUpsert failed: %v", err)
	}

	var vehicle model.Vehicle
	if err := testDB.Where("vehicle_id = ?", vehicleID).First(&vehicle).Error; err != nil {
		t.Fatalf("vehicle not found: %v", err)
	}
	expected := decimal.NewFromFloat(1500.0)
	if !vehicle.MaxWeightKg.Equal(expected) {
		t.Errorf("max weight = %v, want 1500.0", vehicle.MaxWeightKg)
	}
	if len(vehicle.AcceptedPackageTypes) != 2 {
		t.Errorf("accepted types count = %d, want 2", len(vehicle.AcceptedPackageTypes))
	}
}

func TestVehicleService_UpsertUpdatesExisting(t *testing.T) {
	testDB.Exec("TRUNCATE vehicles CASCADE")

	carrierRepo := repository.NewCarrierRepository(testDB)
	carrierSvc := service.NewCarrierService(carrierRepo)

	carrierID := uuid.New()
	if err := carrierSvc.HandleCarrierActivated(context.Background(), events.CarrierActivatedEvent{
		UserID:            carrierID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(4.711),
		BaseLongitude:     decimal.NewFromFloat(-74.0721),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup carrier failed: %v", err)
	}

	repo := repository.NewVehicleRepository(testDB)
	svc := service.NewVehicleService(repo)

	vehicleID := uuid.New()

	// Insertar
	if err := svc.HandleVehicleUpsert(context.Background(), events.VehicleUpsertEvent{
		VehicleID:            vehicleID.String(),
		CarrierID:            carrierID.String(),
		MaxWeightKg:          decimal.NewFromFloat(1500.0),
		AcceptedPackageTypes: []model.PackageType{"BOX"},
		UpdatedAt:            "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("first upsert failed: %v", err)
	}

	// Actualizar
	if err := svc.HandleVehicleUpsert(context.Background(), events.VehicleUpsertEvent{
		VehicleID:            vehicleID.String(),
		CarrierID:            carrierID.String(),
		MaxWeightKg:          decimal.NewFromFloat(2500.0),
		AcceptedPackageTypes: []model.PackageType{"BOX", "PALLET"},
		UpdatedAt:            "2026-10-09T13:00:00Z",
	}); err != nil {
		t.Fatalf("second upsert failed: %v", err)
	}

	var count int64
	testDB.Model(&model.Vehicle{}).Where("vehicle_id = ?", vehicleID).Count(&count)
	if count != 1 {
		t.Errorf("vehicle count = %d, want 1 (upsert should not duplicate)", count)
	}

	var vehicle model.Vehicle
	testDB.Where("vehicle_id = ?", vehicleID).First(&vehicle)
	expected := decimal.NewFromFloat(2500.0)
	if !vehicle.MaxWeightKg.Equal(expected) {
		t.Errorf("max weight = %v, want 2500.0", vehicle.MaxWeightKg)
	}
	if len(vehicle.AcceptedPackageTypes) != 2 {
		t.Errorf("accepted types count = %d, want 2", len(vehicle.AcceptedPackageTypes))
	}
}

func TestVehicleService_DeletedRemovesVehicle(t *testing.T) {
	testDB.Exec("TRUNCATE vehicles CASCADE")
	carrierRepo := repository.NewCarrierRepository(testDB)
	carrierSvc := service.NewCarrierService(carrierRepo)

	carrierID := uuid.New()
	if err := carrierSvc.HandleCarrierActivated(context.Background(), events.CarrierActivatedEvent{
		UserID:            carrierID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(4.711),
		BaseLongitude:     decimal.NewFromFloat(-74.0721),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup carrier failed: %v", err)
	}

	repo := repository.NewVehicleRepository(testDB)
	svc := service.NewVehicleService(repo)

	vehicleID := uuid.New()

	// Insertar
	if err := svc.HandleVehicleUpsert(context.Background(), events.VehicleUpsertEvent{
		VehicleID:            vehicleID.String(),
		CarrierID:            carrierID.String(),
		MaxWeightKg:          decimal.NewFromFloat(1500.0),
		AcceptedPackageTypes: []model.PackageType{"BOX"},
		UpdatedAt:            "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	// Borrar
	if err := svc.HandleVehicleDeleted(context.Background(), events.VehicleDeletedEvent{
		VehicleID: vehicleID.String(),
	}); err != nil {
		t.Fatalf("HandleVehicleDeleted failed: %v", err)
	}

	var count int64
	testDB.Model(&model.Vehicle{}).Where("vehicle_id = ?", vehicleID).Count(&count)
	if count != 0 {
		t.Errorf("vehicle count = %d, want 0 after delete", count)
	}
}
