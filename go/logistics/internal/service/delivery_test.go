package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
)

// --- Mocks ---

type mockDeliveryOrderRepository struct {
	existingOrder *model.DeliveryOrder
	findErr       error

	createErr       error
	createdOrder    *model.DeliveryOrder
	createdLoad     *model.LogisticsLoad
	createdPackages []model.Package

	pendingOrders []model.DeliveryOrder
	pendingErr    error
	pendingLimit  int

	cancelErr         error
	cancelledDelivery *model.DeliveryOrder
	cancelledWindowID *string
	cancelCalls       int
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

func (m *mockDeliveryOrderRepository) FindPendingWithoutWindow(
	ctx context.Context,
	limit int,
) ([]model.DeliveryOrder, error) {
	m.pendingLimit = limit
	return m.pendingOrders, m.pendingErr
}

func (m *mockDeliveryOrderRepository) CancelDeliveryOrder(
	ctx context.Context,
	delivery model.DeliveryOrder,
	windowID *string,
) error {
	m.cancelCalls++
	m.cancelledDelivery = &delivery
	m.cancelledWindowID = windowID
	return m.cancelErr
}

type mockAddressService struct {
	address *model.Address
	err     error
	calls   int
}

func (m *mockAddressService) GetUserAddress(ctx context.Context, userID string) (*model.Address, error) {
	m.calls++
	if m.err != nil {
		return nil, m.err
	}
	return m.address, nil
}

type mockRouteStopService struct {
	routeStop *model.RouteStop
	err       error
	callCount int
}

func (m *mockRouteStopService) CreateRouteStop(
	ctx context.Context,
	latitude, longitude decimal.Decimal,
	stopType model.StopType,
) (*model.RouteStop, error) {
	m.callCount++
	if m.err != nil {
		return nil, m.err
	}
	// Devolver una copia con el StopType correcto
	rs := *m.routeStop
	rs.StopType = stopType
	return &rs, nil
}

// --- Tests ---

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

	validAddress := &model.Address{
		ID:        uuid.New(),
		UserID:    uuid.New(),
		Latitude:  decimal.NewFromFloat(4.711),
		Longitude: decimal.NewFromFloat(-74.0721),
	}

	validRouteStop := &model.RouteStop{
		ID:        uuid.New(),
		Latitude:  decimal.NewFromFloat(4.711),
		Longitude: decimal.NewFromFloat(-74.0721),
	}

	t.Run("creates order successfully", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{}
		mockAddr := &mockAddressService{address: validAddress}
		mockStop := &mockRouteStopService{routeStop: validRouteStop}

		svc := NewDeliveryService(mockRepo, mockAddr, mockStop)

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
		if mockStop.callCount != 2 {
			t.Errorf("CreateRouteStop called %d times, want 2", mockStop.callCount)
		}
		if mockAddr.calls != 2 {
			t.Errorf("GetUserAddress called %d times, want 2", mockAddr.calls)
		}
		// Verificar que los RouteStop del pedido tienen los IDs correctos
		if mockRepo.createdOrder.PickupRouteStopID == uuid.Nil {
			t.Error("expected PickupRouteStopID to be set")
		}
		if mockRepo.createdOrder.DeliveryRouteStopID == uuid.Nil {
			t.Error("expected DeliveryRouteStopID to be set")
		}
	})

	t.Run("skips if order already exists", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{
			existingOrder: &model.DeliveryOrder{ID: uuid.New()},
		}
		mockAddr := &mockAddressService{address: validAddress}
		mockStop := &mockRouteStopService{routeStop: validRouteStop}

		svc := NewDeliveryService(mockRepo, mockAddr, mockStop)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.createdOrder != nil {
			t.Error("expected no order to be created")
		}
		if mockStop.callCount != 0 {
			t.Errorf("CreateRouteStop called %d times, want 0", mockStop.callCount)
		}
		if mockAddr.calls != 0 {
			t.Errorf("GetUserAddress called %d times, want 0", mockAddr.calls)
		}
	})

	t.Run("fails on invalid orderId", func(t *testing.T) {
		badEvent := validEvent
		badEvent.OrderID = "not-a-uuid"

		mockRepo := &mockDeliveryOrderRepository{}
		mockAddr := &mockAddressService{address: validAddress}
		mockStop := &mockRouteStopService{routeStop: validRouteStop}

		svc := NewDeliveryService(mockRepo, mockAddr, mockStop)

		err := svc.HandleOrderPaid(context.Background(), badEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.createdOrder != nil {
			t.Error("expected no order to be created")
		}
	})

	t.Run("fails when address service fails", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{}
		mockAddr := &mockAddressService{err: errors.New("address not found")}
		mockStop := &mockRouteStopService{routeStop: validRouteStop}

		svc := NewDeliveryService(mockRepo, mockAddr, mockStop)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.createdOrder != nil {
			t.Error("expected no order to be created")
		}
		if mockStop.callCount != 0 {
			t.Errorf("CreateRouteStop called %d times, want 0", mockStop.callCount)
		}
	})

	t.Run("fails when route stop service fails", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{}
		mockAddr := &mockAddressService{address: validAddress}
		mockStop := &mockRouteStopService{err: errors.New("stop creation failed")}

		svc := NewDeliveryService(mockRepo, mockAddr, mockStop)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.createdOrder != nil {
			t.Error("expected no order to be created")
		}
	})

	t.Run("fails when repo fails", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{
			createErr: errors.New("db down"),
		}
		mockAddr := &mockAddressService{address: validAddress}
		mockStop := &mockRouteStopService{routeStop: validRouteStop}

		svc := NewDeliveryService(mockRepo, mockAddr, mockStop)

		err := svc.HandleOrderPaid(context.Background(), validEvent)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestFindByOrderID(t *testing.T) {
	t.Run("returns order when found", func(t *testing.T) {
		existing := &model.DeliveryOrder{ID: uuid.New()}
		mockRepo := &mockDeliveryOrderRepository{existingOrder: existing}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		got, err := svc.FindByOrderID(context.Background(), "any-id")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got == nil || got.ID != existing.ID {
			t.Errorf("expected order %s, got %v", existing.ID, got)
		}
	})

	t.Run("returns error when not found", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{existingOrder: nil}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		_, err := svc.FindByOrderID(context.Background(), "any-id")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("propagates repo error", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{findErr: errors.New("db down")}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		_, err := svc.FindByOrderID(context.Background(), "any-id")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestFindPendingWithoutWindow(t *testing.T) {
	t.Run("returns pending orders", func(t *testing.T) {
		orders := []model.DeliveryOrder{
			{ID: uuid.New()},
			{ID: uuid.New()},
		}
		mockRepo := &mockDeliveryOrderRepository{pendingOrders: orders}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		got, err := svc.FindPendingWithoutWindow(context.Background(), 100)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 2 {
			t.Errorf("expected 2 orders, got %d", len(got))
		}
		if mockRepo.pendingLimit != 100 {
			t.Errorf("expected limit 100, got %d", mockRepo.pendingLimit)
		}
	})

	t.Run("returns nil when empty", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{pendingOrders: nil}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		got, err := svc.FindPendingWithoutWindow(context.Background(), 100)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("propagates repo error", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{pendingErr: errors.New("db down")}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		_, err := svc.FindPendingWithoutWindow(context.Background(), 100)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestCancelDeliveryOrder(t *testing.T) {
	orderID := uuid.New()
	windowID := uuid.New()

	validOrder := func() *model.DeliveryOrder {
		return &model.DeliveryOrder{
			ID:               orderID,
			OrderID:          uuid.New(),
			Status:           model.StatusPending,
			GroupingWindowID: nil,
		}
	}

	t.Run("cancels a pending order without window", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{existingOrder: validOrder()}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		event := events.OrderCancelled{OrderID: mockRepo.existingOrder.OrderID.String()}
		err := svc.CancelDeliveryOrder(context.Background(), event)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.cancelCalls != 1 {
			t.Errorf("CancelDeliveryOrder called %d times, want 1", mockRepo.cancelCalls)
		}
		if mockRepo.cancelledWindowID != nil {
			t.Errorf("expected nil windowID, got %v", *mockRepo.cancelledWindowID)
		}
	})

	t.Run("cancels a scheduled order with window, passing the window ID", func(t *testing.T) {
		order := validOrder()
		order.Status = model.StatusScheduled
		order.GroupingWindowID = &windowID

		mockRepo := &mockDeliveryOrderRepository{existingOrder: order}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		event := events.OrderCancelled{OrderID: order.OrderID.String()}
		err := svc.CancelDeliveryOrder(context.Background(), event)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.cancelCalls != 1 {
			t.Errorf("CancelDeliveryOrder called %d times, want 1", mockRepo.cancelCalls)
		}
		if mockRepo.cancelledWindowID == nil {
			t.Fatal("expected non-nil windowID")
		}
		if *mockRepo.cancelledWindowID != windowID.String() {
			t.Errorf("windowID = %s, want %s", *mockRepo.cancelledWindowID, windowID)
		}
	})

	t.Run("fails when event has empty OrderID", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{OrderID: ""})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.cancelCalls != 0 {
			t.Errorf("CancelDeliveryOrder called %d times, want 0", mockRepo.cancelCalls)
		}
	})

	t.Run("propagates FindByOrderID error", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{findErr: errors.New("db down")}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{OrderID: "any"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.cancelCalls != 0 {
			t.Errorf("CancelDeliveryOrder called %d times, want 0", mockRepo.cancelCalls)
		}
	})

	t.Run("returns nil when order does not exist", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{existingOrder: nil}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{OrderID: "any"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.cancelCalls != 0 {
			t.Errorf("CancelDeliveryOrder called %d times, want 0", mockRepo.cancelCalls)
		}
	})

	t.Run("skips when already cancelled with CancelledAt set", func(t *testing.T) {
		now := time.Now()
		order := validOrder()
		order.Status = model.StatusCancelled
		order.CancelledAt = &now

		mockRepo := &mockDeliveryOrderRepository{existingOrder: order}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{OrderID: order.OrderID.String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.cancelCalls != 0 {
			t.Errorf("CancelDeliveryOrder called %d times, want 0 (already cancelled)", mockRepo.cancelCalls)
		}
	})

	t.Run("skips when status not in no-penalization set", func(t *testing.T) {
		order := validOrder()
		order.Status = model.StatusInProgress

		mockRepo := &mockDeliveryOrderRepository{existingOrder: order}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{OrderID: order.OrderID.String()})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.cancelCalls != 0 {
			t.Errorf("CancelDeliveryOrder called %d times, want 0 (status not cancellable)", mockRepo.cancelCalls)
		}
	})

	t.Run("propagates repo CancelDeliveryOrder error", func(t *testing.T) {
		mockRepo := &mockDeliveryOrderRepository{
			existingOrder: validOrder(),
			cancelErr:     errors.New("window not active"),
		}
		svc := NewDeliveryService(mockRepo, &mockAddressService{}, &mockRouteStopService{})

		err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
			OrderID: mockRepo.existingOrder.OrderID.String(),
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.cancelCalls != 1 {
			t.Errorf("CancelDeliveryOrder called %d times, want 1", mockRepo.cancelCalls)
		}
	})
}
