package repository

import (
	"context"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
)

type DeliveryOrderRepository interface {
	Create(ctx context.Context, order *model.DeliveryOrder) error
	FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error)
}

type deliveryOrderRepository struct {
	db *gorm.DB
}

func NewDeliveryOrderRepository(db *gorm.DB) DeliveryOrderRepository {
	return &deliveryOrderRepository{db: db}
}

func (r *deliveryOrderRepository) Create(ctx context.Context, order *model.DeliveryOrder) error {
	return r.db.WithContext(ctx).Create(order).Error
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
