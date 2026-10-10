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

type mockDeliveryOrderRepository struct {
	existingOrder   *model.DeliveryOrder
	findErr         error
	createErr       error
	createdOrder    *model.DeliveryOrder
	createdLoad     *model.LogisticsLoad
	createdPackages []model.Package
}

func (m *mockDeliveryOrderRepository) FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error) {
	return m.existingOrder, m.findErr
}

func (m *mockDeliveryOrderRepository) CreateWithLoadAndPackages(
	ctx context.Context,
	order *model.DeliveryOrder,
	load *model.LogisticsLoad,
	packages []model.Package,
) error {
	m.createdOrder = order
	m.createdLoad = load
	m.createdPackages = packages
	return m.createErr
}

func TestMapPackagesFromEvent(t *testing.T) {
	tests := []struct {
		name            string
		packages        []events.PackageEvent
		wantCount       int
		wantTotalWeight decimal.Decimal
		wantHasFragile  bool
	}{
		{
			name:            "empty list",
			packages:        []events.PackageEvent{},
			wantCount:       0,
			wantTotalWeight: decimal.Zero,
			wantHasFragile:  false,
		},
		{
			name: "single package",
			packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
			},
			wantCount:       1,
			wantTotalWeight: decimal.NewFromFloat(5.0),
			wantHasFragile:  false,
		},
		{
			name: "multiple packages, no fragile",
			packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
				{WeightKg: 3.5, PackageType: "BAG", IsFragile: false},
			},
			wantCount:       2,
			wantTotalWeight: decimal.NewFromFloat(8.5),
			wantHasFragile:  false,
		},
		{
			name: "one fragile among many",
			packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
				{WeightKg: 2.0, PackageType: "BAG", IsFragile: true},
				{WeightKg: 1.0, PackageType: "ENVELOPE", IsFragile: false},
			},
			wantCount:       3,
			wantTotalWeight: decimal.NewFromFloat(8.0),
			wantHasFragile:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &DeliveryService{}
			gotPackages, gotWeight, gotFragile := svc.mapPackagesFromEvent(tt.packages)

			if len(gotPackages) != tt.wantCount {
				t.Errorf("count = %d, want %d", len(gotPackages), tt.wantCount)
			}
			if !gotWeight.Equal(tt.wantTotalWeight) {
				t.Errorf("totalWeight = %s, want %s", gotWeight, tt.wantTotalWeight)
			}
			if gotFragile != tt.wantHasFragile {
				t.Errorf("hasFragile = %v, want %v", gotFragile, tt.wantHasFragile)
			}
		})
	}
}

func TestHandleOrderPaid(t *testing.T) {
	validEvent := events.OrderPaidEvent{
		OrderID:      "550e8400-e29b-41d4-a716-446655440000",
		UserID:       "550e8400-e29b-41d4-a716-446655440001",
		KioskID:      "550e8400-e29b-41d4-a716-446655440002",
		DeliveryMode: "INDIVIDUAL",
		LogisticsLoad: events.LogisticsLoadEvent{
			Packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
			},
		},
	}

	t.Run("creates order successfully", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{}
		svc := NewDeliveryService(mockRepo)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.createdOrder == nil {
			t.Fatal("expected order to be created")
		}
		if mockRepo.createdLoad.TotalWeightKg.String() != "5" {
			t.Errorf("totalWeight = %s, want 5", mockRepo.createdLoad.TotalWeightKg)
		}
	})

	t.Run("skips if order already exists", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{
			existingOrder: &model.DeliveryOrder{ID: uuid.New()},
		}
		svc := NewDeliveryService(mockRepo)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.createdOrder != nil {
			t.Error("expected no order to be created")
		}
	})

	t.Run("fails on invalid orderId", func(t *testing.T) {
		badEvent := validEvent
		badEvent.OrderID = "not-a-uuid"

		mockRepo := &mockDeliveryOrderRepository{}
		svc := NewDeliveryService(mockRepo)

		err := svc.HandleOrderPaid(context.Background(), badEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("fails when repo fails", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{
			createErr: errors.New("db down"),
		}
		svc := NewDeliveryService(mockRepo)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
