package repository

import (
	"context"
	"log"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
)

type DeliveryOrderRepository interface {
	FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error)
	CreateWithLoadAndPackages(ctx context.Context, order *model.DeliveryOrder, load *model.LogisticsLoad, packages []model.Package) error
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
