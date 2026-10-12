package consumer

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

type Consumer[T any] struct {
	reader *kafka.Reader
}

func NewConsumer[T any](brokers []string, topic, groupID string) *Consumer[T] {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       10e3,
		MaxBytes:       10e6,
		CommitInterval: 0,
	})
	return &Consumer[T]{reader: reader}
}

func (c *Consumer[T]) Start(ctx context.Context, handler func(context.Context, T) error) {
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

		var event T
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("error unmarshalling message: %v", err)
			continue
		}

		if err := handler(ctx, event); err != nil {
			log.Printf("error handling event: %v", err)
			continue
		}
		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			log.Printf("error comitting offset: %v", err)
		}
	}
}
