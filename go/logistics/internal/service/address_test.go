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

type mockAddressRepository struct {
	existingAddr *model.Address
	getErr       error

	upsertErr    error
	upsertedAddr *model.Address
	upsertCalled bool

	deleteCalled bool
	deletedAddr  *model.Address
	deleteErr    error

	covered               bool
	checkCoverageErr      error
	checkCoverageCalled   bool
	checkCoverageKioskID  string
	checkCoverageClientID string
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

func (m *mockAddressRepository) CheckCoverage(ctx context.Context, kioskID, clientID string) (bool, error) {
	m.checkCoverageCalled = true
	m.checkCoverageKioskID = kioskID
	m.checkCoverageClientID = clientID
	return m.covered, m.checkCoverageErr
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

func TestCheckCoverage(t *testing.T) {
	kioskID := "550e8400-e29b-41d4-a716-446655440000"
	clientID := "550e8400-e29b-41d4-a716-446655440001"

	validKiosk := &model.Address{
		UserID:   uuid.MustParse(kioskID),
		Role:     "KIOSK",
		Latitude: decimal.NewFromFloat(4.711),
	}
	t.Run("returns true when covered", func(t *testing.T) {
		mock := &mockAddressRepository{
			existingAddr: validKiosk,
			covered:      true,
		}
		svc := NewAddressService(mock)

		covered, err := svc.CheckCoverage(context.Background(), kioskID, clientID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !covered {
			t.Error("expected covered = true")
		}
		if !mock.checkCoverageCalled {
			t.Error("expected repo.CheckCoverage to be called")
		}
	})

	t.Run("returns false when not covered", func(t *testing.T) {
		mock := &mockAddressRepository{
			existingAddr: validKiosk,
			covered:      false,
		}
		svc := NewAddressService(mock)

		covered, err := svc.CheckCoverage(context.Background(), kioskID, clientID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if covered {
			t.Error("expected covered = false")
		}
	})

	t.Run("fails when kiosk address not found", func(t *testing.T) {
		mock := &mockAddressRepository{
			existingAddr: nil, // no hay dirección
		}
		svc := NewAddressService(mock)

		_, err := svc.CheckCoverage(context.Background(), kioskID, clientID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mock.checkCoverageCalled {
			t.Error("expected repo.CheckCoverage NOT to be called")
		}
	})

	t.Run("fails when repo Get fails", func(t *testing.T) {
		mock := &mockAddressRepository{
			getErr: errors.New("db down"),
		}
		svc := NewAddressService(mock)

		_, err := svc.CheckCoverage(context.Background(), kioskID, clientID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("fails when repo CheckCoverage fails", func(t *testing.T) {
		mock := &mockAddressRepository{
			existingAddr:     validKiosk,
			checkCoverageErr: errors.New("postgis error"),
		}
		svc := NewAddressService(mock)

		_, err := svc.CheckCoverage(context.Background(), kioskID, clientID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestGetUserAddress(t *testing.T) {
	validUserID := "550e8400-e29b-41d4-a716-446655440000"
	validAddress := &model.Address{
		UserID:   uuid.MustParse(validUserID),
		Role:     "KIOSK",
		Latitude: decimal.NewFromFloat(4.711),
	}

	t.Run("returns address successfully", func(t *testing.T) {
		mock := &mockAddressRepository{
			existingAddr: validAddress,
		}
		svc := NewAddressService(mock)

		address, err := svc.GetUserAddress(context.Background(), validUserID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if address == nil {
			t.Fatal("expected address, got nil")
		}
		if address.UserID.String() != validUserID {
			t.Errorf("userID = %s, want %s", address.UserID, validUserID)
		}
	})

	t.Run("fails when address not found", func(t *testing.T) {
		mock := &mockAddressRepository{
			existingAddr: nil,
		}
		svc := NewAddressService(mock)

		_, err := svc.GetUserAddress(context.Background(), validUserID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("fails when repo Get fails", func(t *testing.T) {
		mock := &mockAddressRepository{
			getErr: errors.New("db down"),
		}
		svc := NewAddressService(mock)

		_, err := svc.GetUserAddress(context.Background(), validUserID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
