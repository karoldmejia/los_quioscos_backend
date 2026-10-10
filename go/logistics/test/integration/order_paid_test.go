//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/service"
)

func TestHandleOrderPaid_EndToEnd(t *testing.T) {
	testDB.Exec("TRUNCATE delivery_orders, logistics_loads, packages CASCADE")

	repo := repository.NewDeliveryOrderRepository(testDB)
	svc := service.NewDeliveryService(repo)

	orderID := uuid.New()
	event := events.OrderPaidEvent{
		OrderID:      orderID.String(),
		UserID:       uuid.New().String(),
		KioskID:      uuid.New().String(),
		DeliveryMode: "INDIVIDUAL",
		LogisticsLoad: events.LogisticsLoadEvent{
			Packages: []events.PackageEvent{
				{WeightKg: 5.0, PackageType: "BOX", IsFragile: false},
				{WeightKg: 3.0, PackageType: "BAG", IsFragile: true},
			},
		},
	}

	err := svc.HandleOrderPaid(context.Background(), event)
	if err != nil {
		t.Fatalf("HandleOrderPaid failed: %v", err)
	}

	var order model.DeliveryOrder
	err = testDB.Where("order_id = ?", event.OrderID).First(&order).Error
	if err != nil {
		t.Fatalf("order not found in DB: %v", err)
	}

	var load model.LogisticsLoad
	err = testDB.Where("delivery_order_id = ?", order.ID).First(&load).Error
	if err != nil {
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
