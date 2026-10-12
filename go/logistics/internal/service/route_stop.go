package service

import (
	"context"
	"log"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/repository"
	"github.com/shopspring/decimal"
)

type RouteStopService struct {
	repo repository.RouteStopRepository
}

func NewRouteStopService(repo repository.RouteStopRepository) *RouteStopService {
	return &RouteStopService{repo: repo}
}

func (s *RouteStopService) CreateRouteStop(
	ctx context.Context,
	latitude decimal.Decimal, longitude decimal.Decimal,
	stopType model.StopType) (*model.RouteStop, error) {

	routeStop := &model.RouteStop{
		Latitude:  latitude,
		Longitude: longitude,
		StopType:  stopType,
	}
	if err := s.repo.Create(ctx, routeStop); err != nil {
		return nil, err
	}
	log.Printf("RouteStop created with ID %s", routeStop.ID)
	return routeStop, nil
}
