FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /logistics ./cmd/api

FROM alpine:3.19

RUN apk --no-cache add ca-certificates

COPY --from=builder /logistics /logistics

ENTRYPOINT ["/logistics"]