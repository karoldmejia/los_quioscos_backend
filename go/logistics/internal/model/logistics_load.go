package model

import (
	"github.com/google/uuid"

	"github.com/shopspring/decimal"
)

type PackageType string

const (
	BOX      PackageType = "BOX"
	BAG      PackageType = "BAG"
	ENVELOPE PackageType = "ENVELOPE"
	PALLET   PackageType = "PALLET"
	COSTAL   PackageType = "COSTAL"
	OTHER    PackageType = "OTHER"
)

type Package struct {
	WeightKg    decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"weightKg"`
	PackageType PackageType     `gorm:"type:varchar(100);not null" json:"packageType"`
	IsFragile   bool            `gorm:"default:false" json:"isFragile"`
}

type LogisticsLoad struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	OrderID       string          `gorm:"primaryKey" json:"orderId"`
	Packages      []Package       `gorm:"serializer:json;type:jsonb" json:"packages"`
	TotalWeightKg decimal.Decimal `gorm:"type:decimal(10,2);not null" json:"weightKg"`
	HasFragile    bool            `gorm:"default:false"`
}
