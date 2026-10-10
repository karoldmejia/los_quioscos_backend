package repository

import (
	"context"
	"errors"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
)

type VehicleRepository interface {
	Upsert(ctx context.Context, carrier *model.Vehicle) error
	Delete(ctx context.Context, carrier *model.Vehicle) error
	Get(ctx context.Context, carrierID string) (*model.Vehicle, error)
}

type vehicleRepository struct {
	db *gorm.DB
}

func NewVehicleRepository(db *gorm.DB) VehicleRepository {
	return &vehicleRepository{db: db}
}

func (r *vehicleRepository) Upsert(ctx context.Context, vehicle *model.Vehicle) error {
	return r.db.WithContext(ctx).Save(vehicle).Error
}

func (r *vehicleRepository) Delete(ctx context.Context, vehicle *model.Vehicle) error {
	return r.db.WithContext(ctx).Delete(vehicle).Error
}

func (r *vehicleRepository) Get(ctx context.Context, vehicleID string) (*model.Vehicle, error) {
	var vehicle model.Vehicle
	err := r.db.WithContext(ctx).Where("vehicle_id=?", vehicleID).First(&vehicle).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &vehicle, nil
}
