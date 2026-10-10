package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/shopspring/decimal"
)

type mockCarrierRepository struct {
	existing  *model.Carrier
	getErr    error
	createErr error
	updateErr error
	deleteErr error

	createdCarrier *model.Carrier
	updatedCarrier *model.Carrier
	deletedCarrier *model.Carrier
	createCalled   bool
	updateCalled   bool
	deleteCalled   bool
}

func (m *mockCarrierRepository) Get(ctx context.Context, userID string) (*model.Carrier, error) {
	return m.existing, m.getErr
}

func (m *mockCarrierRepository) Create(ctx context.Context, c *model.Carrier) error {
	m.createCalled = true
	m.createdCarrier = c
	return m.createErr
}

func (m *mockCarrierRepository) Update(ctx context.Context, c *model.Carrier) error {
	m.updateCalled = true
	m.updatedCarrier = c
	return m.updateErr
}

func (m *mockCarrierRepository) Delete(ctx context.Context, c *model.Carrier) error {
	m.deleteCalled = true
	m.deletedCarrier = c
	return m.deleteErr
}

func TestHandleCarrierActivated(t *testing.T) {
	validEvent := events.CarrierActivatedEvent{
		UserID:            "550e8400-e29b-41d4-a716-446655440000",
		ServiceRadiusKm:   decimal.NewFromFloat(15.0),
		BaseLatitude:      decimal.NewFromFloat(-74.0721),
		BaseLongitude:     decimal.NewFromFloat(4.7110),
		IsAcceptingRoutes: true,
		ActivatedAt:       "2026-10-09T12:00:00Z",
	}

	t.Run("creates carrier successfully", func(t *testing.T) {
		mock := &mockCarrierRepository{}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierActivated(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.createCalled {
			t.Fatal("expected Create to be called")
		}
		if mock.createdCarrier.UserID.String() != validEvent.UserID {
			t.Errorf("userID = %s, want %s", mock.createdCarrier.UserID, validEvent.UserID)
		}
		if mock.createdCarrier.ServiceRadiusKm != validEvent.ServiceRadiusKm {
			t.Errorf("serviceRadius = %v, want %v", mock.createdCarrier.ServiceRadiusKm, validEvent.ServiceRadiusKm)
		}
	})

	t.Run("skips when carrier already exists", func(t *testing.T) {
		mock := &mockCarrierRepository{
			existing: &model.Carrier{UserID: uuid.New()},
		}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierActivated(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mock.createCalled {
			t.Error("expected Create NOT to be called")
		}
	})

	t.Run("fails on invalid userId", func(t *testing.T) {
		bad := validEvent
		bad.UserID = "not-a-uuid"

		mock := &mockCarrierRepository{}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierActivated(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.createCalled {
			t.Error("expected Create NOT to be called")
		}
	})

	t.Run("fails on invalid activatedAt", func(t *testing.T) {
		bad := validEvent
		bad.ActivatedAt = "not-a-date"

		mock := &mockCarrierRepository{}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierActivated(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("propagates repo error", func(t *testing.T) {
		mock := &mockCarrierRepository{
			createErr: errors.New("db down"),
		}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierActivated(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestHandleCarrierUpdated(t *testing.T) {
	validEvent := events.CarrierUpdatedEvent{
		UserID:            "550e8400-e29b-41d4-a716-446655440000",
		ServiceRadiusKm:   decimal.NewFromFloat(20.0),
		IsAcceptingRoutes: false,
		UpdatedAt:         "2026-10-09T13:00:00Z",
	}

	t.Run("updates carrier successfully", func(t *testing.T) {
		mock := &mockCarrierRepository{
			existing: &model.Carrier{UserID: uuid.MustParse(validEvent.UserID)},
		}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierUpdated(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.updateCalled {
			t.Fatal("expected Update to be called")
		}
		if mock.updatedCarrier.IsAcceptingRoutes != false {
			t.Error("expected IsAcceptingRoutes=false")
		}
	})

	t.Run("skips when carrier does not exist", func(t *testing.T) {
		mock := &mockCarrierRepository{} // existing es nil
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierUpdated(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mock.updateCalled {
			t.Error("expected Update NOT to be called")
		}
	})

	t.Run("fails on invalid updatedAt", func(t *testing.T) {
		bad := validEvent
		bad.UpdatedAt = "yesterday"

		mock := &mockCarrierRepository{
			existing: &model.Carrier{UserID: uuid.MustParse(validEvent.UserID)},
		}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierUpdated(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestHandleCarrierDeleted(t *testing.T) {
	validEvent := events.CarrierDeletedEvent{
		UserID: "550e8400-e29b-41d4-a716-446655440000",
	}

	t.Run("deletes carrier successfully", func(t *testing.T) {
		mock := &mockCarrierRepository{}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierDeleted(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.deleteCalled {
			t.Fatal("expected Delete to be called")
		}
	})

	t.Run("fails on invalid userId", func(t *testing.T) {
		bad := validEvent
		bad.UserID = "nope"

		mock := &mockCarrierRepository{}
		svc := NewCarrierService(mock)

		err := svc.HandleCarrierDeleted(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.deleteCalled {
			t.Error("expected Delete NOT to be called")
		}
	})
}
