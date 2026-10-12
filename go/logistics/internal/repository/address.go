package repository

import (
	"context"
	"errors"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AddressRepository interface {
	Upsert(ctx context.Context, carrier *model.Address) error
	Delete(ctx context.Context, carrier *model.Address) error
	Get(ctx context.Context, carrierID string) (*model.Address, error)
	CheckCoverage(ctx context.Context, kioskUserID, clientUserID string) (bool, error)
}

type addressRepository struct {
	db *gorm.DB
}

func NewAddressRepository(db *gorm.DB) AddressRepository {
	return &addressRepository{db: db}
}

func (r *addressRepository) Upsert(ctx context.Context, address *model.Address) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"role",
				"latitude",
				"longitude",
				"service_radius_km",
				"changed_at",
			}),
		}).Create(address).Error
}

func (r *addressRepository) Delete(ctx context.Context, address *model.Address) error {
	return r.db.WithContext(ctx).Delete(address).Error
}

func (r *addressRepository) Get(ctx context.Context, userID string) (*model.Address, error) {
	var address model.Address
	err := r.db.WithContext(ctx).Where("user_id=?", userID).First(&address).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &address, nil
}

func (r *addressRepository) CheckCoverage(ctx context.Context, kioskUserID, clientUserID string) (bool, error) {
	var covered bool
	err := r.db.WithContext(ctx).Raw(`
			SELECT ST_DWithin(
				kiosk.location,
				client.location,
				kiosk.service_radius_km * 1000
			)
			FROM addresses kiosk
			JOIN addresses client ON client.user_id = ?
			WHERE kiosk.user_id = ?
		`, clientUserID, kioskUserID).Scan(&covered).Error

	if err != nil {
		return false, err
	}
	return covered, nil
}
