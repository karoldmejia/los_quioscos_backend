package service

import (
	"context"
	"errors"
	"testing"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/shopspring/decimal"
)

type mockAddressRepository struct {
	existingAddr *model.Address
	getErr       error

	upsertErr    error
	upsertedAddr *model.Address
	upsertCalled bool

	deleteCalled bool
	deletedAddr  *model.Address
	deleteErr    error
}

func (m *mockAddressRepository) Upsert(ctx context.Context, a *model.Address) error {
	m.upsertCalled = true
	m.upsertedAddr = a
	return m.upsertErr
}

func (m *mockAddressRepository) Delete(ctx context.Context, v *model.Address) error {
	m.deleteCalled = true
	m.deletedAddr = v
	return m.deleteErr
}

func (m *mockAddressRepository) Get(ctx context.Context, addressID string) (*model.Address, error) {
	return m.existingAddr, m.getErr
}

func TestHandleAddressUpdated(t *testing.T) {
	validEvent := events.AddressUpdated{
		UserID:          "550e8400-e29b-41d4-a716-446655440000",
		Role:            "KIOSK",
		Latitude:        decimal.NewFromFloat(4.711),
		Longitude:       decimal.NewFromFloat(-74.0721),
		ServiceRadiusKm: decimal.NewFromFloat(15.0),
		ChangedAt:       "2026-10-09T12:00:00Z",
	}

	t.Run("upserts address successfully", func(t *testing.T) {
		mock := &mockAddressRepository{}
		svc := NewAddressService(mock)

		err := svc.HandleAddressUpdated(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.upsertCalled {
			t.Fatal("expected Upsert to be called")
		}
		if mock.upsertedAddr.UserID.String() != validEvent.UserID {
			t.Errorf("userID = %s, want %s", mock.upsertedAddr.UserID, validEvent.UserID)
		}
		if mock.upsertedAddr.Role != validEvent.Role {
			t.Errorf("role = %s, want %s", mock.upsertedAddr.Role, validEvent.Role)
		}
		if !mock.upsertedAddr.Latitude.Equal(validEvent.Latitude) {
			t.Errorf("latitude = %s, want %s", mock.upsertedAddr.Latitude, validEvent.Latitude)
		}
		if !mock.upsertedAddr.Longitude.Equal(validEvent.Longitude) {
			t.Errorf("longitude = %s, want %s", mock.upsertedAddr.Longitude, validEvent.Longitude)
		}
		if mock.upsertedAddr.ServiceRadiusKm == nil {
			t.Fatal("expected ServiceRadiusKm to be set")
		}
		if !mock.upsertedAddr.ServiceRadiusKm.Equal(validEvent.ServiceRadiusKm) {
			t.Errorf("serviceRadiusKm = %s, want %s",
				mock.upsertedAddr.ServiceRadiusKm, validEvent.ServiceRadiusKm)
		}
	})

	t.Run("upserts customer address without radius", func(t *testing.T) {
		customerEvent := validEvent
		customerEvent.Role = "CUSTOMER"
		// Para clientes, el radio es cero (que representa "no aplica").

		mock := &mockAddressRepository{}
		svc := NewAddressService(mock)

		err := svc.HandleAddressUpdated(context.Background(), customerEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mock.upsertCalled {
			t.Fatal("expected Upsert to be called")
		}
		if mock.upsertedAddr.Role != "CUSTOMER" {
			t.Errorf("role = %s, want CUSTOMER", mock.upsertedAddr.Role)
		}
	})

	t.Run("fails on invalid userId", func(t *testing.T) {
		bad := validEvent
		bad.UserID = "not-a-uuid"

		mock := &mockAddressRepository{}
		svc := NewAddressService(mock)

		err := svc.HandleAddressUpdated(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.upsertCalled {
			t.Error("expected Upsert NOT to be called")
		}
	})

	t.Run("fails on invalid changedAt", func(t *testing.T) {
		bad := validEvent
		bad.ChangedAt = "yesterday"

		mock := &mockAddressRepository{}
		svc := NewAddressService(mock)

		err := svc.HandleAddressUpdated(context.Background(), bad)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.upsertCalled {
			t.Error("expected Upsert NOT to be called")
		}
	})

	t.Run("propagates repo error", func(t *testing.T) {
		mock := &mockAddressRepository{
			upsertErr: errors.New("db down"),
		}
		svc := NewAddressService(mock)

		err := svc.HandleAddressUpdated(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
