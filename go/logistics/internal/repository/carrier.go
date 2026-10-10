package repository

import (
	"context"
	"errors"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
)

type CarrierRepository interface {
	Create(ctx context.Context, carrier *model.Carrier) error
	Update(ctx context.Context, carrier *model.Carrier) error
	Delete(ctx context.Context, carrier *model.Carrier) error
	Get(ctx context.Context, carrierID string) (*model.Carrier, error)
}

type carrierRepository struct {
	db *gorm.DB
}

func NewCarrierRepository(db *gorm.DB) CarrierRepository {
	return &carrierRepository{db: db}
}

func (r *carrierRepository) Create(ctx context.Context, carrier *model.Carrier) error {
	return r.db.WithContext(ctx).Create(carrier).Error
}

func (r *carrierRepository) Update(ctx context.Context, carrier *model.Carrier) error {
	return r.db.WithContext(ctx).Model(&model.Carrier{}).
		Where("user_id=?", carrier.UserID).
		Updates(map[string]interface{}{
			"service_radius_km":   carrier.ServiceRadiusKm,
			"is_accepting_routes": carrier.IsAcceptingRoutes,
			"updated_at":          carrier.UpdatedAt,
		}).Error
}

func (r *carrierRepository) Delete(ctx context.Context, carrier *model.Carrier) error {
	return r.db.WithContext(ctx).Delete(carrier).Error
}

func (r *carrierRepository) Get(ctx context.Context, carrierID string) (*model.Carrier, error) {
	var carrier model.Carrier
	err := r.db.WithContext(ctx).Where("user_id=?", carrierID).First(&carrier).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &carrier, nil
}
