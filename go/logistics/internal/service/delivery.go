package service

import (
	"context"
	"log"

	"github.com/google/uuid"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
)

type DeliveryService struct {
	repo repository.DeliveryOrderRepository
}

func NewDeliveryService(repo repository.DeliveryOrderRepository) *DeliveryService {
	return &DeliveryService{repo: repo}
}

func (s *DeliveryService) HandleOrderPaid(ctx context.Context, event events.OrderPaidEvent) error {
	existing, err := s.repo.FindByOrderID(ctx, event.OrderID)
	if err != nil {
		return err
	}
	if existing != nil {
		log.Printf("DeliveryOrder already exists for order %s, skipping", event.OrderID)
		return nil
	}

	if err := event.LogisticsLoad.OrderID != event.OrderID; err == true {
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

	order := &model.DeliveryOrder{
		OrderID:      orderID,
		UserID:       userID,
		KioskID:      kioskID,
		DeliveryMode: model.DeliveryMode(event.DeliveryMode),
		Status:       model.StatusPending,
	}

	if err := s.repo.Create(ctx, order); err != nil {
		return err
	}

	log.Printf("Delivery order created for order %s", event.OrderID)
	return nil

}
