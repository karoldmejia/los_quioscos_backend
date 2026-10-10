package service

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
	"github.com/shopspring/decimal"
)

type DeliveryService struct {
	repo repository.DeliveryOrderRepository
}

func NewDeliveryService(repo repository.DeliveryOrderRepository) *DeliveryService {
	return &DeliveryService{repo: repo}
}

func (s *DeliveryService) HandleOrderPaid(ctx context.Context, event events.OrderPaidEvent) error {
	if event.OrderID == "" || event.UserID == "" || event.KioskID == "" {
		return fmt.Errorf("event missing required fields: orderId=%q", event.OrderID)
	}

	existing, err := s.repo.FindByOrderID(ctx, event.OrderID)
	if err != nil {
		return err
	}
	if existing != nil {
		log.Printf("DeliveryOrder already exists for order %s, skipping", event.OrderID)
		return nil
	}

	orderID, err := uuid.Parse(event.OrderID)
	if err != nil {
		return err
	}
	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return err
	}
	kioskID, err := uuid.Parse(event.KioskID)
	if err != nil {
		return err
	}

	modelPackages, totalWeight, hasFragile := s.mapPackagesFromEvent(event.LogisticsLoad.Packages)

	order := &model.DeliveryOrder{
		OrderID:      orderID,
		UserID:       userID,
		KioskID:      kioskID,
		DeliveryMode: model.DeliveryMode(event.DeliveryMode),
		Status:       model.StatusPending,
	}
	load := &model.LogisticsLoad{
		TotalWeightKg: totalWeight,
		IsFragile:     hasFragile,
	}

	return s.repo.CreateWithLoadAndPackages(ctx, order, load, modelPackages)
}

func (s *DeliveryService) mapPackagesFromEvent(packages []events.PackageEvent) ([]model.Package, decimal.Decimal, bool) {
	modelPackages := make([]model.Package, 0, len(packages))
	totalWeight := decimal.Zero
	hasFragile := false

	for _, p := range packages {
		weight := decimal.NewFromFloat(p.WeightKg)
		modelPackages = append(modelPackages, model.Package{
			WeightKg:    weight,
			PackageType: model.PackageType(p.PackageType),
			IsFragile:   p.IsFragile,
		})

		totalWeight = totalWeight.Add(weight)
		if p.IsFragile {
			hasFragile = true
		}
	}

	return modelPackages, totalWeight, hasFragile
}
