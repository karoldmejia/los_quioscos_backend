package service

import (
	"context"
	"fmt"
	"log"
	"log/slog"

	"github.com/google/uuid"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
	"github.com/shopspring/decimal"
)

type AddressProvider interface {
	GetUserAddress(ctx context.Context, userID string) (*model.Address, error)
}

type RouteStopProvider interface {
	CreateRouteStop(
		ctx context.Context,
		latitude decimal.Decimal, longitude decimal.Decimal,
		stopType model.StopType) (*model.RouteStop, error)
}
type DeliveryService struct {
	repo             repository.DeliveryOrderRepository
	addressService   AddressProvider
	routeStopService RouteStopProvider
}

func NewDeliveryService(repo repository.DeliveryOrderRepository, addressService AddressProvider, routeStopService RouteStopProvider) *DeliveryService {
	return &DeliveryService{
		repo:             repo,
		addressService:   addressService,
		routeStopService: routeStopService,
	}

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

	userID, err := uuid.Parse(event.UserID)
	if err != nil {
		return err
	}
	kioskID, err := uuid.Parse(event.KioskID)
	if err != nil {
		return err
	}

	orderID, err := uuid.Parse(event.OrderID)
	if err != nil {
		return err
	}

	modelPackages, totalWeight, hasFragile := s.mapPackagesFromEvent(event.LogisticsLoad.Packages)
	pickupStop, deliveryStop, err := s.createRouteStopsFromAddresses(ctx, event.KioskID, event.UserID)
	if err != nil {
		return err
	}

	order := &model.DeliveryOrder{
		OrderID:             orderID,
		UserID:              userID,
		KioskID:             kioskID,
		DeliveryMode:        model.DeliveryMode(event.DeliveryMode),
		Status:              model.StatusPending,
		PickupRouteStopID:   pickupStop.ID,
		DeliveryRouteStopID: deliveryStop.ID,
		PickupRouteStop:     pickupStop,
		DeliveryRouteStop:   deliveryStop,
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

func (s *DeliveryService) createRouteStopsFromAddresses(ctx context.Context, pickupID, deliveryID string) (*model.RouteStop, *model.RouteStop, error) {
	pickupAddress, err := s.addressService.GetUserAddress(ctx, pickupID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get pickup address: %w", err)
	}

	deliveryAddress, err := s.addressService.GetUserAddress(ctx, deliveryID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get delivery address: %w", err)
	}

	pickupRouteStop, err := s.routeStopService.CreateRouteStop(ctx, pickupAddress.Latitude, pickupAddress.Longitude, model.StopTypePickup)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get create pickup route stop: %w", err)
	}
	deliveryRouteStop, err := s.routeStopService.CreateRouteStop(ctx, deliveryAddress.Latitude, deliveryAddress.Longitude, model.StopTypeDelivery)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get create pickup route stop: %w", err)
	}

	return pickupRouteStop, deliveryRouteStop, nil

}

func (s *DeliveryService) FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error) {
	delivery, err := s.repo.FindByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if delivery == nil {
		slog.InfoContext(ctx, "delivery order not found", "orderId", orderID)
		return nil, fmt.Errorf("delivery order %s not found", orderID)
	}
	return delivery, nil
}

func (s *DeliveryService) FindPendingWithoutWindow(ctx context.Context, limit int) ([]model.DeliveryOrder, error) {
	deliveries, err := s.repo.FindPendingWithoutWindow(ctx, limit)
	if err != nil {
		return nil, err
	}
	if len(deliveries) == 0 {
		slog.InfoContext(ctx, "there are not pending deliveries to be added to windows")
		return nil, nil
	}
	return deliveries, nil
}
