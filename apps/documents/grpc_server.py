from src.document_impl import DocumentService
from generated import documents_pb2_grpc
from generated import documents_pb2

class DocumentGrpcServer(
    documents_pb2_grpc.DocumentServiceServicer
):

    async def ValidateDocument(self, request, context):

        service = DocumentService()

        result = await service.process_document(
            user_id=request.user_id,
            doc_type_id=request.doc_type_id,
            files_bytes=list(request.files),
            selfie_bytes = request.selfie if request.HasField("selfie") else None
        )

        return documents_pb2.DocumentValidationResponse(
            is_valid=result.get("is_valid", False),
            error_code=result.get("error_code", ""),
            error_message=result.get("error_message", "")
        )
