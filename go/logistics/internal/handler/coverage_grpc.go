package handler

import (
	"context"

	pb "github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/proto/logistics"
	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type CoverageGRPCHandler struct {
	pb.UnimplementedLogisticsServiceServer
	svc *service.AddressService
}

func NewCoverageGRPCHandler(svc *service.AddressService) *CoverageGRPCHandler {
	return &CoverageGRPCHandler{svc: svc}
}

func (h *CoverageGRPCHandler) CheckCoverage(ctx context.Context, req *pb.CheckCoverageRequest) (*pb.CheckCoverageResponse, error) {
	covered, err := h.svc.CheckCoverage(ctx, req.PickupId, req.DeliveryId)
	if err != nil {
		return nil, status.Errorf(codes.FailedPrecondition, "coverage check failed: %v", err)
	}
	return &pb.CheckCoverageResponse{Covered: covered}, nil
}
