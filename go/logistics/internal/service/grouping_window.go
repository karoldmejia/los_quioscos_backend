package service

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
)

type DeliveryOrderProvider interface {
	FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error)
	FindPendingWithoutWindow(ctx context.Context, limit int) ([]model.DeliveryOrder, error)
}

type GroupingWindowService struct {
	repo            repository.GroupingWindowRepository
	deliveryService DeliveryOrderProvider
}

func NewGroupingWindowService(repo repository.GroupingWindowRepository, deliveryService DeliveryOrderProvider) *GroupingWindowService {
	return &GroupingWindowService{
		repo:            repo,
		deliveryService: deliveryService,
	}
}

func (s *GroupingWindowService) AddDeliveryToWindow(ctx context.Context, orderID string) error {
	delivery, err := s.deliveryService.FindByOrderID(ctx, orderID)
	if err != nil {
		return err
	}
	if err := s.validateDeliveryForWindow(ctx, delivery); err != nil {
		return err
	}
	candidateWindows, err := s.repo.GetCandidateWindowsForDelivery(ctx, delivery.PickupRouteStopID.String(), delivery.DeliveryRouteStopID.String())
	if err != nil {
		return err
	}
	if len(candidateWindows) == 0 {
		return s.CreateWindow(ctx, delivery)
	}
	for _, window := range candidateWindows {
		err := s.repo.AddDeliveryToWindow(ctx, &window, delivery)
		if err != nil {
			slog.InfoContext(ctx, "candidate window rejected", "windowId", window.ID, "orderId", delivery.OrderID, "reason", err.Error())
			continue
		}
		return nil
	}
	slog.InfoContext(ctx, "no candidate window accepted the delivery, creating new window", "orderId", delivery.OrderID, "candidates", len(candidateWindows))
	return s.CreateWindow(ctx, delivery)
}

func (s *GroupingWindowService) validateDeliveryForWindow(ctx context.Context, delivery *model.DeliveryOrder) error {
	if delivery.Status != model.StatusPending {
		slog.InfoContext(ctx, "delivery status is not pending", "orderId", delivery.OrderID)
		return fmt.Errorf("delivery status %s is not pending", delivery.OrderID)
	}
	if delivery.DeliveryMode != model.DeliveryModeGrouped {
		slog.InfoContext(ctx, "delivery mode is not grouped", "orderId", delivery.OrderID)
		return fmt.Errorf("delivery mode %s is not grouped", delivery.OrderID)
	}
	if delivery.PickupRouteStopID == uuid.Nil {
		slog.InfoContext(ctx, "delivery pickup stop is not defined", "orderId", delivery.OrderID)
		return fmt.Errorf("delivery pickup stop %s is not defined", delivery.OrderID)
	}
	if delivery.DeliveryRouteStopID == uuid.Nil {
		slog.InfoContext(ctx, "delivery delivery stop is not defined", "orderId", delivery.OrderID)
		return fmt.Errorf("delivery delivery stop %s is not defined", delivery.OrderID)
	}
	return nil
}

func (s *GroupingWindowService) CreateWindow(ctx context.Context, delivery *model.DeliveryOrder) error {
	newWindow := &model.GroupingWindow{
		Status:         model.WindowStatusActive,
		MaxTimeMinutes: 60,
		MaxOrders:      10,
		OrderCount:     0,
	}
	window, err := s.repo.Upsert(ctx, newWindow)
	if err != nil {
		return err
	}
	if err := s.repo.AddDeliveryToWindow(ctx, window, delivery); err != nil {
		return err
	}
	return nil

}

func (s *GroupingWindowService) processPendingOrders(ctx context.Context) error {
	const batchSize = 100
	const pendingTimeout = 5 * time.Minute

	pending, err := s.deliveryService.FindPendingWithoutWindow(ctx, batchSize)
	if err != nil {
		return fmt.Errorf("fetching pending orders: %w", err)
	}
	if len(pending) == 0 {
		return nil
	}

	slog.InfoContext(ctx, "processing pending orders", "count", len(pending))

	for _, delivery := range pending {
		if err := s.AddDeliveryToWindow(ctx, delivery.OrderID.String()); err == nil {
			continue
		}
		if time.Since(delivery.CreatedAt) >= pendingTimeout {
			slog.InfoContext(ctx, "pending order timeout, creating new window",
				"orderId", delivery.OrderID,
				"waited", time.Since(*delivery.CancelledAt))
			if err := s.CreateWindow(ctx, &delivery); err != nil {
				slog.ErrorContext(ctx, "failed to create window for pending order", "orderId", delivery.OrderID, "err", err)
			}
			continue
		}
		slog.DebugContext(ctx, "pending order still waiting", "orderId", delivery.OrderID, "waited", time.Since(delivery.CreatedAt))
	}
	return nil
}

func StartPendingOrdersJob(ctx context.Context, svc *GroupingWindowService, interval time.Duration){
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var mu sync.Mutex

	for {
		select {
		case <- ctx.Done():
			return
		case <- ticker.C:
			if !mu.TryLock(){
				slog.WarnContext(ctx, "skipping pending orders cycle: previous still running")
				continue
			}
			func(){
				defer mu.Unlock()
				if err := svc.processPendingOrders(ctx); err !=nil{
					slog.ErrorContext(ctx, "pending orders job failed", "err", err)
				}
			}()
		}
	}
}
