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

func setupCancelTest(t *testing.T) (*service.DeliveryService, uuid.UUID, uuid.UUID) {
	t.Helper()

	testDB.Exec("TRUNCATE packages, logistics_loads, delivery_orders, route_stops, addresses, grouping_windows CASCADE")

	addressRepo := repository.NewAddressRepository(testDB)
	routeStopRepo := repository.NewRouteStopRepository(testDB)
	deliveryRepo := repository.NewDeliveryOrderRepository(testDB)

	addressSvc := service.NewAddressService(addressRepo)
	routeStopSvc := service.NewRouteStopService(routeStopRepo)
	deliverySvc := service.NewDeliveryService(deliveryRepo, addressSvc, routeStopSvc)

	kioskID := uuid.New()
	clientID := uuid.New()

	if err := addressSvc.HandleAddressUpdated(context.Background(), events.AddressUpdated{
		UserID:    kioskID.String(),
		Role:      "KIOSK",
		Latitude:  decimal.NewFromFloat(4.711),
		Longitude: decimal.NewFromFloat(-74.0721),
		ChangedAt: "2026-10-12T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup kiosk address failed: %v", err)
	}
	if err := addressSvc.HandleAddressUpdated(context.Background(), events.AddressUpdated{
		UserID:    clientID.String(),
		Role:      "CUSTOMER",
		Latitude:  decimal.NewFromFloat(4.721),
		Longitude: decimal.NewFromFloat(-74.0821),
		ChangedAt: "2026-10-12T12:00:00Z",
	}); err != nil {
		t.Fatalf("setup client address failed: %v", err)
	}

	return deliverySvc, kioskID, clientID
}

// createPendingOrder crea una DeliveryOrder en estado PENDING usando el flujo real.
func createPendingOrder(t *testing.T, svc *service.DeliveryService, kioskID, clientID uuid.UUID) *model.DeliveryOrder {
	t.Helper()

	orderID := uuid.New()
	event := events.OrderPaidEvent{
		OrderID:      orderID.String(),
		UserID:       clientID.String(),
		KioskID:      kioskID.String(),
		DeliveryMode: "INDIVIDUAL",
		LogisticsLoad: events.LogisticsLoadEvent{
			Packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
			},
		},
	}
	if err := svc.HandleOrderPaid(context.Background(), event); err != nil {
		t.Fatalf("HandleOrderPaid failed: %v", err)
	}

	var order model.DeliveryOrder
	if err := testDB.Where("order_id = ?", event.OrderID).First(&order).Error; err != nil {
		t.Fatalf("order not found in DB: %v", err)
	}
	return &order
}

func TestCancelDeliveryOrder_EndToEnd(t *testing.T) {
	svc, kioskID, clientID := setupCancelTest(t)
	order := createPendingOrder(t, svc, kioskID, clientID)

	// WHEN: se procesa order.cancelled
	if err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: order.OrderID.String(),
	}); err != nil {
		t.Fatalf("CancelDeliveryOrder failed: %v", err)
	}

	// THEN: el pedido quedó CANCELLED con CancelledAt seteado
	var got model.DeliveryOrder
	if err := testDB.Where("id = ?", order.ID).First(&got).Error; err != nil {
		t.Fatalf("order not found after cancel: %v", err)
	}
	if got.Status != model.StatusCancelled {
		t.Errorf("status = %s, want %s", got.Status, model.StatusCancelled)
	}
	if got.CancelledAt == nil {
		t.Error("expected CancelledAt to be set")
	}
	if got.GroupingWindowID != nil {
		t.Errorf("expected GroupingWindowID to be nil, got %v", *got.GroupingWindowID)
	}
}

func TestCancelDeliveryOrder_NotFound_IsNoop(t *testing.T) {
	svc, _, _ := setupCancelTest(t)

	// WHEN: se cancela un orderID que no existe
	err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: uuid.New().String(),
	})
	// THEN: no hay error, no se crea nada
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var count int64
	testDB.Model(&model.DeliveryOrder{}).Count(&count)
	if count != 0 {
		t.Errorf("expected 0 delivery_orders, got %d", count)
	}
}

func TestCancelDeliveryOrder_AlreadyCancelled_IsIdempotent(t *testing.T) {
	svc, kioskID, clientID := setupCancelTest(t)
	order := createPendingOrder(t, svc, kioskID, clientID)

	// cancelar una vez
	if err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: order.OrderID.String(),
	}); err != nil {
		t.Fatalf("first cancel failed: %v", err)
	}

	var first model.DeliveryOrder
	if err := testDB.Where("id = ?", order.ID).First(&first).Error; err != nil {
		t.Fatalf("order not found: %v", err)
	}
	if first.CancelledAt == nil {
		t.Fatal("expected CancelledAt to be set after first cancel")
	}
	cancelledAt := *first.CancelledAt

	// cancelar otra vez
	if err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: order.OrderID.String(),
	}); err != nil {
		t.Fatalf("second cancel failed: %v", err)
	}

	var second model.DeliveryOrder
	if err := testDB.Where("id = ?", order.ID).First(&second).Error; err != nil {
		t.Fatalf("order not found: %v", err)
	}
	if second.Status != model.StatusCancelled {
		t.Errorf("status = %s, want %s", second.Status, model.StatusCancelled)
	}
	if second.CancelledAt == nil || !second.CancelledAt.Equal(cancelledAt) {
		t.Errorf("CancelledAt changed on second cancel: first=%v second=%v", cancelledAt, second.CancelledAt)
	}
}

func TestCancelDeliveryOrder_WithWindow_RemovesFromWindow(t *testing.T) {
	svc, kioskID, clientID := setupCancelTest(t)
	order := createPendingOrder(t, svc, kioskID, clientID)

	// GIVEN: la orden está en una ventana activa con order_count = 1
	window := model.GroupingWindow{
		ID:         uuid.New(),
		Status:     model.WindowStatusActive,
		OrderCount: 1,
	}
	if err := testDB.Create(&window).Error; err != nil {
		t.Fatalf("creating window failed: %v", err)
	}
	if err := testDB.Model(&model.DeliveryOrder{}).
		Where("id = ?", order.ID).
		Update("grouping_window_id", window.ID).Error; err != nil {
		t.Fatalf("attaching order to window failed: %v", err)
	}

	// WHEN: se cancela
	if err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: order.OrderID.String(),
	}); err != nil {
		t.Fatalf("CancelDeliveryOrder failed: %v", err)
	}

	// THEN: la orden quedó cancelada y fuera de la ventana
	var got model.DeliveryOrder
	if err := testDB.Where("id = ?", order.ID).First(&got).Error; err != nil {
		t.Fatalf("order not found: %v", err)
	}
	if got.Status != model.StatusCancelled {
		t.Errorf("status = %s, want %s", got.Status, model.StatusCancelled)
	}
	if got.GroupingWindowID != nil {
		t.Errorf("expected GroupingWindowID to be nil, got %v", *got.GroupingWindowID)
	}

	// THEN: la ventana bajó su order_count a 0
	var gotWindow model.GroupingWindow
	if err := testDB.Where("id = ?", window.ID).First(&gotWindow).Error; err != nil {
		t.Fatalf("window not found: %v", err)
	}
	if gotWindow.OrderCount != 0 {
		t.Errorf("window order_count = %d, want 0", gotWindow.OrderCount)
	}
}

func TestCancelDeliveryOrder_WithInactiveWindow_FailsAndRollsBack(t *testing.T) {
	svc, kioskID, clientID := setupCancelTest(t)
	order := createPendingOrder(t, svc, kioskID, clientID)

	// GIVEN: la orden está en una ventana NO activa
	window := model.GroupingWindow{
		ID:         uuid.New(),
		Status:     model.WindowStatusClosed, // o el estado no-activo que uses
		OrderCount: 1,
	}
	if err := testDB.Create(&window).Error; err != nil {
		t.Fatalf("creating window failed: %v", err)
	}
	if err := testDB.Model(&model.DeliveryOrder{}).
		Where("id = ?", order.ID).
		Update("grouping_window_id", window.ID).Error; err != nil {
		t.Fatalf("attaching order to window failed: %v", err)
	}

	// WHEN: se cancela
	err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: order.OrderID.String(),
	})

	// THEN: hay error (ventana no activa)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	// THEN: rollback, la orden NO quedó cancelada ni salió de la ventana
	var got model.DeliveryOrder
	if err := testDB.Where("id = ?", order.ID).First(&got).Error; err != nil {
		t.Fatalf("order not found: %v", err)
	}
	if got.Status == model.StatusCancelled {
		t.Error("expected status NOT to be CANCELLED after rollback")
	}
	if got.CancelledAt != nil {
		t.Error("expected CancelledAt to be nil after rollback")
	}
	if got.GroupingWindowID == nil || *got.GroupingWindowID != window.ID {
		t.Errorf("expected order to remain in window %s", window.ID)
	}

	// THEN: el order_count de la ventana NO cambió
	var gotWindow model.GroupingWindow
	if err := testDB.Where("id = ?", window.ID).First(&gotWindow).Error; err != nil {
		t.Fatalf("window not found: %v", err)
	}
	if gotWindow.OrderCount != 1 {
		t.Errorf("window order_count = %d, want 1 (unchanged after rollback)", gotWindow.OrderCount)
	}
}

func TestCancelDeliveryOrder_NotCancellableStatus_IsNoop(t *testing.T) {
	svc, kioskID, clientID := setupCancelTest(t)
	order := createPendingOrder(t, svc, kioskID, clientID)

	// GIVEN: la orden tiene un status no cancelable
	if err := testDB.Model(&model.DeliveryOrder{}).
		Where("id = ?", order.ID).
		Update("status", model.StatusInProgress).Error; err != nil {
		t.Fatalf("setting status failed: %v", err)
	}

	// WHEN: se intenta cancelar
	if err := svc.CancelDeliveryOrder(context.Background(), events.OrderCancelled{
		OrderID: order.OrderID.String(),
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// THEN: no cambió nada
	var got model.DeliveryOrder
	if err := testDB.Where("id = ?", order.ID).First(&got).Error; err != nil {
		t.Fatalf("order not found: %v", err)
	}
	if got.Status != model.StatusInProgress {
		t.Errorf("status = %s, want %s (should not change)", got.Status, model.StatusInProgress)
	}
	if got.CancelledAt != nil {
		t.Error("expected CancelledAt to remain nil")
	}
}
