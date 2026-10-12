package users

import (
	pb "github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/proto/users"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func NewUsersClient(address string) (pb.UsersServiceClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return pb.NewUsersServiceClient(conn), nil
}
