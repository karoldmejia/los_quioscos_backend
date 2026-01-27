import asyncio
import grpc
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "generated"))

from grpc_server import DocumentGrpcServer
from generated import documents_pb2_grpc


async def serve():
    server = grpc.aio.server()

    documents_pb2_grpc.add_DocumentServiceServicer_to_server(
        DocumentGrpcServer(),
        server
    )

    server.add_insecure_port("[::]:8000")

    print("Document gRPC service running on port 8000")

    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
