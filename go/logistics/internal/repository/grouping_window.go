package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GroupingWindowRepository interface {
	Upsert(ctx context.Context, window *model.GroupingWindow) (*model.GroupingWindow, error)
	Delete(ctx context.Context, window *model.GroupingWindow) error
	Get(ctx context.Context, windowID string) (*model.GroupingWindow, error)
	GetCandidateWindowsForDelivery(ctx context.Context, pickupID, deliveryID string) ([]model.GroupingWindow, error)
	AddDeliveryToWindow(ctx context.Context, window *model.GroupingWindow, delivery *model.DeliveryOrder) error
	CloseActiveWindows(ctx context.Context) ([]model.GroupingWindow, error)
}

type groupingWindowRepository struct {
	db *gorm.DB
}

func NewGroupingWindowRepository(db *gorm.DB) GroupingWindowRepository {
	return &groupingWindowRepository{db: db}
}

func (r *groupingWindowRepository) Upsert(ctx context.Context, groupingWindow *model.GroupingWindow) (*model.GroupingWindow, error) {
	err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"status",
				"max_time_minutes",
				"max_orders",
				"updated_at",
				"closed_at",
				"close_reason",
			}),
		}).Create(groupingWindow).Error
	if err != nil {
		return nil, err
	}
	return groupingWindow, nil
}

func (r *groupingWindowRepository) Delete(ctx context.Context, groupingWindow *model.GroupingWindow) error {
	return r.db.WithContext(ctx).Delete(groupingWindow).Error
}

func (r *groupingWindowRepository) Get(ctx context.Context, windowID string) (*model.GroupingWindow, error) {
	var groupingWindow model.GroupingWindow
	err := r.db.WithContext(ctx).Where("id=?", windowID).First(&groupingWindow).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &groupingWindow, nil
}

func (r *groupingWindowRepository) GetCandidateWindowsForDelivery(ctx context.Context, pickupID, deliveryID string) ([]model.GroupingWindow, error) {
	var windows []model.GroupingWindow

	const prefilterRadius = 15000
	const validationRadius = 10000

	query := `
		SELECT w.*
		FROM groupingWindow w
		WHERE w.status 'ACTIVE'
			AND w.opened_at + make_interval(mins => w.max_time_minutes) > NOW()
			AND w.order_count < w.max_orders
			AND EXISTS (
				SELECT 1
				FROM delivery_orders d
				JOIN route_stops rs ON rs.id IN (d.pickup_route_stop_id, d.delivery_route_stop_id)
				WHERE d.grouping_window_id = w.id
					AND ST_DWithin(
						rs.location,
						(SELECT location FROM route_stops WHERE id = ?), ?
					)
			)
			AND EXISTS (
				SELECT 1
				FROM delivery_orders d
				JOIN route_stops rs ON rs.id IN (d.pickup_route_stop_id, d.delivery_route_stop_id)
				WHERE d.grouping_window_id = w.id
					AND ST_DWithin(
						rs.location,
						(SELECT location FROM route_stops WHERE id = ?), ?
					)
			)
			AND EXISTS (
				SELECT 1
				FROM delivery_orders d
				JOIN route_stops rs ON rs.id IN (d.pickup_route_stop_id, d.delivery_route_stop_id)
				WHERE d.grouping_window_id = w.id
					AND ST_DWithin(
						rs.location,
						(SELECT location FROM route_stops WHERE id = ?), ?
					)
			)
			ORDER BY (
				SELECT MIN(ST_Distance(rs.location, (SELECT location FROM route_stops WHERE id = ?)))
				FROM delivery_orders d
				JOIN route_stops rs ON rd.id IN (d.pickup_route_stop_id, d.delivery_route_stop_id)
				WHERE d.grouping_window_id = w.id
			) ASC
			LIMIT 10
			`

	err := r.db.WithContext(ctx).Raw(
		query,
		pickupID, prefilterRadius,
		pickupID, validationRadius,
		deliveryID, validationRadius,
		pickupID,
	).Scan(&windows).Error

	if err != nil {
		return nil, err
	}
	return windows, nil
}

func (r *groupingWindowRepository) AddDeliveryToWindow(ctx context.Context, window *model.GroupingWindow, delivery *model.DeliveryOrder) error {
	var updated *model.GroupingWindow

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&updated, "id=?", window.ID).Error; err != nil {
			return fmt.Errorf("loading window for update: %w", err)
		}
		if updated.Status != model.WindowStatusActive {
			return fmt.Errorf("window %s is not active", updated.ID)
		}
		expiresAt := updated.OpenedAt.Add(time.Duration(updated.MaxTimeMinutes) * time.Minute)
		if time.Now().After(expiresAt) {
			return fmt.Errorf("window %s has expired", updated.ID)
		}
		if updated.OrderCount >= updated.MaxOrders {
			return fmt.Errorf("window %s is full", updated.ID)
		}

		if delivery.GroupingWindowID != nil {
			return fmt.Errorf("delivery %s already has a window", delivery.OrderID)
		}
		delivery.GroupingWindowID = &updated.ID
		if err := tx.Model(delivery).Update("grouping_window_id", updated.ID).Error; err != nil {
			return fmt.Errorf("adding delivery to window: %w", err)
		}
		delivery.Status = model.StatusWindowAssigned
		if err := tx.Model(delivery).Update("status", model.StatusWindowAssigned).Error; err != nil {
			return fmt.Errorf("updating delivery status: %w", err)
		}
		if err := tx.Model(&updated).Update("order_count", gorm.Expr("order_count + 1")).Error; err != nil {
			return fmt.Errorf("updating window order count: %w", err)
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}

func (r *groupingWindowRepository) closeWindow(ctx context.Context, windowID uuid.UUID, reason model.CloseReason) (bool, error) {
	var keep bool

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var w model.GroupingWindow

		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&w, "id=? AND status = ?", windowID, model.WindowStatusActive).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return fmt.Errorf("loading window for update: %w", err)
		}
		if err := tx.Model(&w).Update("status", model.WindowStatusClosed).Error; err != nil {
			return fmt.Errorf("updating delivery status: %w", err)
		}
		var count int64
		if err := tx.Model(&model.DeliveryOrder{}).
			Where("grouping_window_id = ? AND status != ?", w.ID, model.StatusCancelled).
			Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			if err := tx.Delete(&w).Error; err != nil {
				return err
			}
			keep = false
			return nil
		}
		if err := tx.Model(&w).Updates(map[string]interface{}{
			"status":       model.WindowStatusClosed,
			"closed_at":    time.Now(),
			"close_reason": reason,
		}).Error; err != nil {
			return err
		}
		keep = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return keep, nil
}

func (r *groupingWindowRepository) CloseActiveWindows(ctx context.Context) ([]model.GroupingWindow, error) {
	var expired []model.GroupingWindow
	var full []model.GroupingWindow
	var windowsForRoutes []model.GroupingWindow
	err := r.db.WithContext(ctx).
		Where("status = ?", model.WindowStatusActive).
		Where("opened at + make_interval(mins => max_time_minutes) <= NOW").
		Find(&expired).Error
	if err != nil {
		return nil, err
	}
	err = r.db.WithContext(ctx).
		Where("status = ?", model.WindowStatusActive).
		Where("order_count >= max_orders").
		Find(&full).Error
	if err != nil {
		return nil, err
	}

	for _, w := range expired {
		keep, err := r.closeWindow(ctx, w.ID, model.CloseReasonTimeReached)
		if err != nil {
			return nil, err
		}
		if keep {
			windowsForRoutes = append(windowsForRoutes, w)
		}
	}

	for _, w := range full {
		keep, err := r.closeWindow(ctx, w.ID, model.CloseReasonMaxOrdersReached)
		if err != nil {
			return nil, err
		}
		if keep {
			windowsForRoutes = append(windowsForRoutes, w)
		}
	}

	return windowsForRoutes, nil
}
