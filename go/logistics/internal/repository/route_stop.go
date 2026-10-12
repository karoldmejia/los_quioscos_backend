package repository

import (
	"context"
	"errors"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"gorm.io/gorm"
)

type RouteStopRepository interface {
	Create(ctx context.Context, routeStop *model.RouteStop) error
	Delete(ctx context.Context, routeStop *model.RouteStop) error
	Get(ctx context.Context, routeStopID string) (*model.RouteStop, error)
}

type routeStopRepository struct {
	db *gorm.DB
}

func NewRouteStopRepository(db *gorm.DB) RouteStopRepository {
	return &routeStopRepository{db: db}
}

func (r *routeStopRepository) Create(ctx context.Context, routeStop *model.RouteStop) error {
	return r.db.WithContext(ctx).Create(routeStop).Error
}
func (r *routeStopRepository) Delete(ctx context.Context, routeStop *model.RouteStop) error {
	return r.db.WithContext(ctx).Delete(routeStop).Error
}

func (r *routeStopRepository) Get(ctx context.Context, routeStopID string) (*model.RouteStop, error) {
	var routeStop model.RouteStop
	err := r.db.WithContext(ctx).Where("id=?", routeStopID).First(&routeStop).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &routeStop, nil
}
