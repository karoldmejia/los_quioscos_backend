package events

import (
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
	"github.com/shopspring/decimal"
)

type VehicleUpsertEvent struct {
	VehicleID            string              `json:"vehicleId"`
	CarrierID            string              `json:"carrierId"`
	MaxWeightKg          decimal.Decimal     `json:"maxWeightKg"`
	AcceptedPackageTypes []model.PackageType `json:"acceptedPackageTypes"`
	UpdatedAt            string              `json:"updatedAt"`
}

type VehicleDeletedEvent struct {
	VehicleID string `json:"vehicleId"`
	DeletedAt string `json:"deletedAt"`
}
