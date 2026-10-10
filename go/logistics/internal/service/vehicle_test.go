package service

import (
	"context"
	"errors"
	"testing"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/shopspring/decimal"
)

type mockVehicleRepository struct {
	existingVehicle *model.Vehicle
	getErr          error
	upsertErr       error
	deleteErr       error

	upsertedVehicle *model.Vehicle
	deletedVehicle  *model.Vehicle
	upsertCalled    bool
	deleteCalled    bool
}

func (m *mockVehicleRepository) Get(ctx context.Context, vehicleID string) (*model.Vehicle, error) {
	return m.existingVehicle, m.getErr
}

func (m *mockVehicleRepository) Upsert(ctx context.Context, v *model.Vehicle) error {
	m.upsertCalled = true
	m.upsertedVehicle = v
	return m.upsertErr
}

func (m *mockVehicleRepository) Delete(ctx context.Context, v *model.Vehicle) error {
	m.deleteCalled = true
	m.deletedVehicle = v
	return m.deleteErr
}

func TestHandleVehicleUpsert(t *testing.T) {
	validEvent := events.VehicleUpsertEvent{
		VehicleID:            "550e8400-e29b-41d4-a716-446655440000",
		CarrierID:            "550e8400-e29b-41d4-a716-446655440001",
		MaxWeightKg:          decimal.NewFromFloat(1500.0),
		AcceptedPackageTypes: []model.PackageType{"BOX", "BAG"},
		UpdatedAt:            "2026-10-09T12:00:00Z",
	}

	t.Run("upserts vehicle successfully", func(t *testing.T) {
		mock := &mockVehicleRepository{}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleUpsert(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.upsertCalled {
			t.Fatal("expected Upsert to be called")
		}
		if mock.upsertedVehicle.VehicleID.String() != validEvent.VehicleID {
			t.Errorf("vehicleID = %s, want %s", mock.upsertedVehicle.VehicleID, validEvent.VehicleID)
		}
		if mock.upsertedVehicle.CarrierID.String() != validEvent.CarrierID {
			t.Errorf("carrierID = %s, want %s", mock.upsertedVehicle.CarrierID, validEvent.CarrierID)
		}
		if len(mock.upsertedVehicle.AcceptedPackageTypes) != 2 {
			t.Errorf("acceptedTypes = %d, want 2", len(mock.upsertedVehicle.AcceptedPackageTypes))
		}
	})

	t.Run("fails on invalid vehicleId", func(t *testing.T) {
		bad := validEvent
		bad.VehicleID = "not-a-uuid"

		mock := &mockVehicleRepository{}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleUpsert(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.upsertCalled {
			t.Error("expected Upsert NOT to be called")
		}
	})

	t.Run("fails on invalid carrierId", func(t *testing.T) {
		bad := validEvent
		bad.CarrierID = "not-a-uuid"

		mock := &mockVehicleRepository{}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleUpsert(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("fails on invalid updatedAt", func(t *testing.T) {
		bad := validEvent
		bad.UpdatedAt = "yesterday"

		mock := &mockVehicleRepository{}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleUpsert(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("propagates repo error", func(t *testing.T) {
		mock := &mockVehicleRepository{
			upsertErr: errors.New("db down"),
		}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleUpsert(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestHandleVehicleDeleted(t *testing.T) {
	validEvent := events.VehicleDeletedEvent{
		VehicleID: "550e8400-e29b-41d4-a716-446655440000",
	}

	t.Run("deletes vehicle successfully", func(t *testing.T) {
		mock := &mockVehicleRepository{}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleDeleted(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.deleteCalled {
			t.Fatal("expected Delete to be called")
		}
	})

	t.Run("fails on invalid vehicleId", func(t *testing.T) {
		bad := validEvent
		bad.VehicleID = "nope"

		mock := &mockVehicleRepository{}
		svc := NewVehicleService(mock)

		err := svc.HandleVehicleDeleted(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.deleteCalled {
			t.Error("expected Delete NOT to be called")
		}
	})
}
