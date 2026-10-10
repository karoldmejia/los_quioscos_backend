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

func TestCarrierService_ActivatedCreatesCarrier(t *testing.T) {
	testDB.Exec("TRUNCATE carriers CASCADE")

	repo := repository.NewCarrierRepository(testDB)
	svc := service.NewCarrierService(repo)

	userID := uuid.New()
	event := events.CarrierActivatedEvent{
		UserID:            userID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(4.711),
		BaseLongitude:     decimal.NewFromFloat(-74.0721),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}

	if err := svc.HandleCarrierActivated(context.Background(), event); err != nil {
		t.Fatalf("HandleCarrierActivated failed: %v", err)
	}

	var carrier model.Carrier
	if err := testDB.Where("user_id = ?", userID).First(&carrier).Error; err != nil {
		t.Fatalf("carrier not found in DB: %v", err)
	}
	expected := decimal.NewFromFloat(15.0)
	if !carrier.ServiceRadiusKm.Equal(expected) {
		t.Errorf("service radius = %v, want 15.0", carrier.ServiceRadiusKm)
	}
	if !carrier.IsAcceptingRoutes {
		t.Error("expected IsAcceptingRoutes = true")
	}
}

func TestCarrierService_ActivatedIsIdempotent(t *testing.T) {
	testDB.Exec("TRUNCATE carriers CASCADE")

	repo := repository.NewCarrierRepository(testDB)
	svc := service.NewCarrierService(repo)

	userID := uuid.New()
	event := events.CarrierActivatedEvent{
		UserID:            userID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(4.711),
		BaseLongitude:     decimal.NewFromFloat(-74.0721),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}

	// Primera llamada: crea
	if err := svc.HandleCarrierActivated(context.Background(), event); err != nil {
		t.Fatalf("first call failed: %v", err)
	}

	// Segunda llamada: debe ser ignorada
	if err := svc.HandleCarrierActivated(context.Background(), event); err != nil {
		t.Fatalf("second call failed: %v", err)
	}

	var count int64
	testDB.Model(&model.Carrier{}).Where("user_id = ?", userID).Count(&count)
	if count != 1 {
		t.Errorf("carrier count = %d, want 1", count)
	}
}

func TestCarrierService_UpdatedModifiesCarrier(t *testing.T) {
	testDB.Exec("TRUNCATE carriers CASCADE")

	repo := repository.NewCarrierRepository(testDB)
	svc := service.NewCarrierService(repo)

	userID := uuid.New()

	// Crear primero
	if err := svc.HandleCarrierActivated(context.Background(), events.CarrierActivatedEvent{
		UserID:            userID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(4.711),
		BaseLongitude:     decimal.NewFromFloat(-74.0721),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup failed: %v", err)
	}

	// Actualizar
	if err := svc.HandleCarrierUpdated(context.Background(), events.CarrierUpdatedEvent{
		UserID:            userID.String(),
		ServiceRadiusKm:   decimal.NewFromFloat(25.0),
		IsAcceptingRoutes: false,
		UpdatedAt:         "2026-10-09T13:00:00Z",
	}); err != nil {
		t.Fatalf("HandleCarrierUpdated failed: %v", err)
	}

	var carrier model.Carrier
	testDB.Where("user_id = ?", userID).First(&carrier)
	expected := decimal.NewFromFloat(25.0)
	if !carrier.ServiceRadiusKm.Equal(expected) {
		t.Errorf("service radius = %v, want 25.0", carrier.ServiceRadiusKm)
	}
	if carrier.IsAcceptingRoutes {
		t.Error("expected IsAcceptingRoutes = false")
	}
}
