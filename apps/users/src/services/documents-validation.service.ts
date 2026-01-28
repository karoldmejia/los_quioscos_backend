import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { DocumentServiceGrpc } from '../grpc/documents.interface';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class DocumentsValidationService implements OnModuleInit{
    private documentsService: DocumentServiceGrpc;
    
  constructor(
    @Inject('DOCUMENTS_GRPC') private readonly client: ClientGrpc,
  ) {}

      onModuleInit() {
          this.documentsService =
          this.client.getService<DocumentServiceGrpc>('DocumentService');
      }
  

    async validateDocument(userId: number, docTypeId: string, files: Buffer[], selfie?: Buffer) {
        const request: any = {user_id: userId, doc_type_id: docTypeId, files};
        if (selfie) {
            request.selfie = selfie;
        }
        const response = await lastValueFrom(this.documentsService.ValidateDocument(request));
        return response;
    }
}