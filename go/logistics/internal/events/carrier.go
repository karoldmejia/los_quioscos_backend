package events

import "github.com/shopspring/decimal"

type CarrierActivatedEvent struct {
	UserID            string          `json:"userId"`
	ServiceRadiusKm   decimal.Decimal `json:"serviceRadiusKm"`
	BaseLatitude      decimal.Decimal `json:"baseLatitude"`
	BaseLongitude     decimal.Decimal `json:"baseLongitude"`
	IsAcceptingRoutes bool            `json:"isAcceptingRoutes"`
	ActivatedAt       string          `json:"activatedAt"`
}

type CarrierUpdatedEvent struct {
	UserID            string          `json:"userId"`
	ServiceRadiusKm   decimal.Decimal `json:"serviceRadiusKm"`
	IsAcceptingRoutes bool            `json:"isAcceptingRoutes"`
	UpdatedAt         string          `json:"updatedAt"`
}

type CarrierDeletedEvent struct {
	UserID    string `json:"userId"`
	DeletedAt string `json:"deletedAt"`
}
