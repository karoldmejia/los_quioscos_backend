package events

type CarrierActivatedEvent struct {
	UserID            string `json:"userId"`
	IsAcceptingRoutes bool   `json:"isAcceptingRoutes"`
	ActivatedAt       string `json:"activatedAt"`
}

type CarrierUpdatedEvent struct {
	UserID            string `json:"userId"`
	IsAcceptingRoutes bool   `json:"isAcceptingRoutes"`
	UpdatedAt         string `json:"updatedAt"`
}

type CarrierDeletedEvent struct {
	UserID    string `json:"userId"`
	DeletedAt string `json:"deletedAt"`
}
