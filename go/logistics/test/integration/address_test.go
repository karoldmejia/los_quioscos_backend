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

func TestAddressService_UpsertCreatesAddress(t *testing.T) {
	testDB.Exec("TRUNCATE addresses CASCADE")

	repo := repository.NewAddressRepository(testDB)
	svc := service.NewAddressService(repo)

	userID := uuid.New()

	event := events.AddressUpdated{
		UserID:          userID.String(),
		Role:            "KIOSK",
		Latitude:        decimal.NewFromFloat(4.711),
		Longitude:       decimal.NewFromFloat(-74.0721),
		ServiceRadiusKm: decimal.NewFromFloat(15.0),
		ChangedAt:       "2026-10-09T12:00:00Z",
	}

	if err := svc.HandleAddressUpdated(context.Background(), event); err != nil {
		t.Fatalf("HandleAddressUpdated failed: %v", err)
	}

	var address model.Address
	if err := testDB.Where("user_id = ?", userID).First(&address).Error; err != nil {
		t.Fatalf("address not found: %v", err)
	}

	if !address.Latitude.Equal(decimal.NewFromFloat(4.711)) {
		t.Errorf("latitude = %s, want 4.711", address.Latitude)
	}
	if !address.Longitude.Equal(decimal.NewFromFloat(-74.0721)) {
		t.Errorf("longitude = %s, want -74.0721", address.Longitude)
	}
	if address.Role != "KIOSK" {
		t.Errorf("role = %s, want KIOSK", address.Role)
	}
	if address.ServiceRadiusKm == nil {
		t.Fatal("expected ServiceRadiusKm to be set")
	}
	if !address.ServiceRadiusKm.Equal(decimal.NewFromFloat(15.0)) {
		t.Errorf("serviceRadiusKm = %s, want 15.0", address.ServiceRadiusKm)
	}
}

func TestAddressService_UpsertUpdatesExisting(t *testing.T) {
	testDB.Exec("TRUNCATE addresses CASCADE")

	repo := repository.NewAddressRepository(testDB)
	svc := service.NewAddressService(repo)

	userID := uuid.New()

	// Primer upsert: crear
	if err := svc.HandleAddressUpdated(context.Background(), events.AddressUpdated{
		UserID:          userID.String(),
		Role:            "KIOSK",
		Latitude:        decimal.NewFromFloat(4.711),
		Longitude:       decimal.NewFromFloat(-74.0721),
		ServiceRadiusKm: decimal.NewFromFloat(15.0),
		ChangedAt:       "2026-10-09T12:00:00Z",
	}); err != nil {
		t.Fatalf("first upsert failed: %v", err)
	}

	// Guardar el ID para verificar que no cambia
	var firstAddress model.Address
	testDB.Where("user_id = ?", userID).First(&firstAddress)
	originalID := firstAddress.ID

	// Segundo upsert: actualizar
	if err := svc.HandleAddressUpdated(context.Background(), events.AddressUpdated{
		UserID:          userID.String(),
		Role:            "KIOSK",
		Latitude:        decimal.NewFromFloat(4.721),
		Longitude:       decimal.NewFromFloat(-74.0821),
		ServiceRadiusKm: decimal.NewFromFloat(25.0),
		ChangedAt:       "2026-10-09T13:00:00Z",
	}); err != nil {
		t.Fatalf("second upsert failed: %v", err)
	}

	// Verificar que no se duplicó
	var count int64
	testDB.Model(&model.Address{}).Where("user_id = ?", userID).Count(&count)
	if count != 1 {
		t.Errorf("address count = %d, want 1 (upsert should not duplicate)", count)
	}

	// Verificar que los datos se actualizaron
	var address model.Address
	testDB.Where("user_id = ?", userID).First(&address)
	if !address.Latitude.Equal(decimal.NewFromFloat(4.721)) {
		t.Errorf("latitude = %s, want 4.721", address.Latitude)
	}
	if !address.Longitude.Equal(decimal.NewFromFloat(-74.0821)) {
		t.Errorf("longitude = %s, want -74.0821", address.Longitude)
	}
	if address.ServiceRadiusKm == nil {
		t.Fatal("expected ServiceRadiusKm to be set")
	}
	if !address.ServiceRadiusKm.Equal(decimal.NewFromFloat(25.0)) {
		t.Errorf("serviceRadiusKm = %s, want 25.0", address.ServiceRadiusKm)
	}

	// Verificar que el ID se conservó (no se regeneró)
	if address.ID != originalID {
		t.Errorf("address ID changed from %s to %s (upsert should preserve PK)", originalID, address.ID)
	}
}
