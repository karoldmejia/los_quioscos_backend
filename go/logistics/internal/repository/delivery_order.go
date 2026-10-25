package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DeliveryOrderRepository interface {
	FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error)
	CreateWithLoadAndPackages(ctx context.Context, order *model.DeliveryOrder, load *model.LogisticsLoad, packages []model.Package) error
	FindPendingWithoutWindow(ctx context.Context, limit int) ([]model.DeliveryOrder, error)
	CancelDeliveryOrder(ctx context.Context, delivery model.DeliveryOrder, window *string) error
}

type deliveryOrderRepository struct {
	db *gorm.DB
}

func NewDeliveryOrderRepository(db *gorm.DB) DeliveryOrderRepository {
	return &deliveryOrderRepository{db: db}
}

func (r *deliveryOrderRepository) FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error) {
	var order model.DeliveryOrder
	err := r.db.WithContext(ctx).Where("order_id=?", orderID).First(&order).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *deliveryOrderRepository) CreateWithLoadAndPackages(ctx context.Context, order *model.DeliveryOrder, load *model.LogisticsLoad, packages []model.Package) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		log.Printf("BEFORE Create(order): order.ID=%s order.OrderID=%s", order.ID, order.OrderID)

		if err := tx.Create(order).Error; err != nil {
			return err
		}
		log.Printf("AFTER Create(order): order.ID=%s order.OrderID=%s", order.ID, order.OrderID)

		load.DeliveryOrderID = order.ID
		load.DeliveryOrder = order
		log.Printf("load.DeliveryOrderID set to: %s", load.DeliveryOrderID)

		if err := tx.Create(load).Error; err != nil {
			return err
		}
		for i := range packages {
			packages[i].LogisticsLoadID = load.ID
		}
		if err := tx.Create(&packages).Error; err != nil {
			return err
		}
		return nil
	})
}

func (r *deliveryOrderRepository) FindPendingWithoutWindow(ctx context.Context, limit int) ([]model.DeliveryOrder, error) {
	var deliveries []model.DeliveryOrder
	err := r.db.WithContext(ctx).
		Where("status=?", model.StatusPending).
		Where("grouping_window_id IS NULL").
		Where("delivery_mode = ?", model.DeliveryModeGrouped).
		Order("created_at ASC").
		Limit(limit).
		Find(&deliveries).Error

	if err != nil {
		return nil, err
	}
	return deliveries, nil
}

func (r *deliveryOrderRepository) CancelDeliveryOrder(ctx context.Context, delivery model.DeliveryOrder, windowID *string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if windowID != nil {
			var updated model.GroupingWindow
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&updated, "id=?", windowID).Error; err != nil {
				return fmt.Errorf("loading window for update: %w", err)
			}

			if updated.Status != model.WindowStatusActive {
				return fmt.Errorf("window %s is not active", updated.ID)
			}

			result := tx.Model(&model.DeliveryOrder{}).
				Where("id = ? AND grouping_window_id = ?", delivery.ID, updated.ID).
				Update("grouping_window_id", nil)
			if result.Error != nil {
				return fmt.Errorf("removing delivery from window: %w", result.Error)
			}
			if result.RowsAffected != 1 {
				return fmt.Errorf("delivery %s was not in window %s", delivery.ID, updated.ID)
			}

			result = tx.Model(&model.GroupingWindow{}).
				Where("id=? AND order_count >0", updated.ID).
				Update("order_count", gorm.Expr("order_count - 1"))
			if result.Error != nil {
				return fmt.Errorf("decrementing window order count: %w", result.Error)
			}
			if result.RowsAffected != 1 {
				return fmt.Errorf("window %s order count was already 0", updated.ID)
			}
		}
		result := tx.Model(&model.DeliveryOrder{}).
			Where("id = ?", delivery.ID).
			Updates(map[string]interface{}{
				"status":       model.StatusCancelled,
				"cancelled_at": time.Now(),
			})
		if result.Error != nil {
			return fmt.Errorf("marking delivery as cancelled: %w", result.Error)
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("delivery %s not found when cancelling", delivery.ID)
		}
		return nil
	})
}
