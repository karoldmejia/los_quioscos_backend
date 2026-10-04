package consumer

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/events"
	"github.com/segmentio/kafka-go"
)

type OrderCreatedConsumer struct {
	reader *kafka.Reader
}

func NewOrderCreatedConsumer(brokers []string, topic, groupID string) *OrderCreatedConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       10e3,
		MaxBytes:       10e6,
		CommitInterval: 0,
	})
	return &OrderCreatedConsumer{reader: reader}
}

func (c *OrderCreatedConsumer) Start(ctx context.Context, handler func(events.OrderPaidEvent) error) {
	defer c.reader.Close()

	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("error reading message: %v", err)
			if ctx.Err() != nil {
				return
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Second):
			}
			continue
		}

		var event events.OrderPaidEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("error unmarshalling message: %v", err)
			continue
		}

		if err := handler(event); err != nil {
			log.Printf("error handling event: %v", err)
			continue
		}
		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			log.Printf("error comitting offset: %v", err)
		}
	}
}
