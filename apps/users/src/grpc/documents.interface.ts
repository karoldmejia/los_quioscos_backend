import { Observable } from 'rxjs';

export interface DocumentServiceGrpc {
  ValidateDocument(data: {
    user_id: string;
    doc_type_id: string;
    files: Buffer[];
  }): Observable<{
    is_valid: boolean;
    error_code: string;
    error_message: string;
  }>;
}