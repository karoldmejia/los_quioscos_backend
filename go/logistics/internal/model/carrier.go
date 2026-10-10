package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type Carrier struct {
	UserID            uuid.UUID       `gorm:"type:uuid;primaryKey"`
	ServiceRadiusKm   decimal.Decimal `gorm:"type:decimal(10,2)"`
	BaseLatitude      decimal.Decimal `gorm:"type:decimal(10,7)"`
	BaseLongitude     decimal.Decimal `gorm:"type:decimal(10,7)"`
	IsAcceptingRoutes bool            `gorm:"default:true"`
	Vehicle           *Vehicle        `gorm:"foreignKey:CarrierID"`
	ActivatedAt       time.Time       `gorm:"type:timestamptz"`
	UpdatedAt         *time.Time      `gorm:"type:timestamptz"`
	DeletedAt         gorm.DeletedAt  `gorm:"index"`
}

type Vehicle struct {
	VehicleID            uuid.UUID       `gorm:"type:uuid;primaryKey"`
	CarrierID            uuid.UUID       `gorm:"type:uuid;not null;uniqueIndex"`
	MaxWeightKg          decimal.Decimal `gorm:"type:decimal(10,2)"`
	AcceptedPackageTypes []PackageType   `gorm:"serializer:json;type:jsonb" json:"acceptedPackageTypes"`
	UpdatedAt            time.Time       `gorm:"type:timestamptz"`
	DeletedAt            gorm.DeletedAt  `gorm:"index"`
}
