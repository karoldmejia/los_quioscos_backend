import grpc
from generated import documents_pb2_grpc
from generated import documents_pb2


def run():
    channel = grpc.insecure_channel("localhost:8000")
    stub = documents_pb2_grpc.DocumentServiceStub(channel)

    response = stub.ValidateDocument(
        documents_pb2.DocumentValidationRequest(
            user_id=1,
            doc_type_id=1,
            files=[]
        )
    )

    print(response)


if __name__ == "__main__":
    run()
