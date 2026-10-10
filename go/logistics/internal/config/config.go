package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	DB    DBConfig
	Kafka KafkaConfig
}

type DBConfig struct {
	DSN string
}

type KafkaConfig struct {
	Brokers []string
}

func Load() (*Config, error) {
	cfg := &Config{
		DB: DBConfig{
			DSN: getEnv("DATABASE_URL", "host=localhost user=postgres password=postgres dbname=logistics port=5432 sslmode=disable"),
		},
		Kafka: KafkaConfig{
			Brokers: strings.Split(getEnv("KAFKA_BROKERS", "localhost:9092"), ","),
		},
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	if c.DB.DSN == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if len(c.Kafka.Brokers) == 0 {
		return fmt.Errorf("KAFKA_BROKERS must contain at least one broker")
	}
	for i, b := range c.Kafka.Brokers {
		if strings.TrimSpace(b) == "" {
			return fmt.Errorf("KAFKA_BROKERS contains an empty broker at position %d", i)
		}
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
