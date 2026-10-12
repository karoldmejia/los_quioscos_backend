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

func TestHandleOrderPaid_EndToEnd(t *testing.T) {
	testDB.Exec("TRUNCATE packages, logistics_loads, delivery_orders, route_stops, addresses CASCADE")

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

	// GIVEN: un evento order.paid
	orderID := uuid.New()
	event := events.OrderPaidEvent{
		OrderID:      orderID.String(),
		UserID:       clientID.String(),
		KioskID:      kioskID.String(),
		DeliveryMode: "INDIVIDUAL",
		LogisticsLoad: events.LogisticsLoadEvent{
			Packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
				{WeightKg: 3.0, PackageType: "BAG", IsFragile: true},
			},
		},
	}

	// WHEN: se procesa el evento
	if err := deliverySvc.HandleOrderPaid(context.Background(), event); err != nil {
		t.Fatalf("HandleOrderPaid failed: %v", err)
	}

	// THEN: el pedido se creó
	var order model.DeliveryOrder
	if err := testDB.Where("order_id = ?", event.OrderID).First(&order).Error; err != nil {
		t.Fatalf("order not found in DB: %v", err)
	}

	if order.PickupRouteStopID == uuid.Nil {
		t.Error("expected PickupRouteStopID to be set")
	}
	if order.DeliveryRouteStopID == uuid.Nil {
		t.Error("expected DeliveryRouteStopID to be set")
	}
	if order.PickupRouteStopID == order.DeliveryRouteStopID {
		t.Error("expected pickup and delivery stops to be different")
	}

	var pickupStop model.RouteStop
	if err := testDB.Where("id = ?", order.PickupRouteStopID).First(&pickupStop).Error; err != nil {
		t.Fatalf("pickup stop not found: %v", err)
	}
	if pickupStop.StopType != model.StopTypePickup {
		t.Errorf("pickup stop type = %s, want PICKUP", pickupStop.StopType)
	}
	if !pickupStop.Latitude.Equal(decimal.NewFromFloat(4.711)) {
		t.Errorf("pickup latitude = %s, want 4.711", pickupStop.Latitude)
	}
	if !pickupStop.Longitude.Equal(decimal.NewFromFloat(-74.0721)) {
		t.Errorf("pickup longitude = %s, want -74.0721", pickupStop.Longitude)
	}

	var deliveryStop model.RouteStop
	if err := testDB.Where("id = ?", order.DeliveryRouteStopID).First(&deliveryStop).Error; err != nil {
		t.Fatalf("delivery stop not found: %v", err)
	}
	if deliveryStop.StopType != model.StopTypeDelivery {
		t.Errorf("delivery stop type = %s, want DELIVERY", deliveryStop.StopType)
	}
	if !deliveryStop.Latitude.Equal(decimal.NewFromFloat(4.721)) {
		t.Errorf("delivery latitude = %s, want 4.721", deliveryStop.Latitude)
	}
	if !deliveryStop.Longitude.Equal(decimal.NewFromFloat(-74.0821)) {
		t.Errorf("delivery longitude = %s, want -74.0821", deliveryStop.Longitude)
	}

	var load model.LogisticsLoad
	if err := testDB.Where("delivery_order_id = ?", order.ID).First(&load).Error; err != nil {
		t.Fatalf("load not found: %v", err)
	}
	if load.TotalWeightKg.String() != "8" {
		t.Errorf("total weight = %s, want 8", load.TotalWeightKg)
	}
	if !load.IsFragile {
		t.Error("expected IsFragile = true")
	}

	var packages []model.Package
	testDB.Where("logistics_load_id = ?", load.ID).Find(&packages)
	if len(packages) != 2 {
		t.Errorf("packages count = %d, want 2", len(packages))
	}
}
