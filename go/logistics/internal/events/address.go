package events

import "github.com/shopspring/decimal"

type AddressUpdated struct {
	UserID          string          `json:"userId"`
	Role            string          `json:"role"`
	Latitude        decimal.Decimal `json:"latitude"`
	Longitude       decimal.Decimal `json:"longitude"`
	ServiceRadiusKm decimal.Decimal `json:"serviceRadiusKm"`
	ChangedAt       string          `json:"changedAt"`
}
