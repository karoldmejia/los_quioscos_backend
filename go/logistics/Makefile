.PHONY: help test test-integration test-all build run tidy fmt vet check clean

# Variables
BINARY_NAME=logistics
CMD_PATH=./cmd/api
GO=go

## help: Muestra esta ayuda
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

## test: Corre los tests unitarios (rápido, sin Docker)
test:
	$(GO) test ./internal/...

## test-integration: Corre los tests de integración (lento, requiere Docker)
test-integration:
	$(GO) test -tags=integration ./test/integration/...

## test-all: Corre unitarios e integración
test-all: test test-integration

## build: Compila el binario en ./bin/logistics
build:
	$(GO) build -o ./bin/$(BINARY_NAME) $(CMD_PATH)

## run: Corre el servicio localmente (sin Docker)
run:
	$(GO) run $(CMD_PATH)

## tidy: Limpia y ordena las dependencias de go.mod/go.sum
tidy:
	$(GO) mod tidy

## fmt: Formatea el código con gofmt
fmt:
	$(GO) fmt ./...

## vet: Analiza el código en busca de problemas comunes
vet:
	$(GO) vet ./...

## check: Corre fmt, vet y tests unitarios (útil antes de commitear)
check: fmt vet test

## clean: Limpia el binario compilado
clean:
	rm -rf ./bin