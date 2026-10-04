import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { DeleteRequest as _photos_DeleteRequest, DeleteRequest__Output as _photos_DeleteRequest__Output } from './photos/DeleteRequest';
import type { DeleteResponse as _photos_DeleteResponse, DeleteResponse__Output as _photos_DeleteResponse__Output } from './photos/DeleteResponse';
import type { PhotosServiceClient as _photos_PhotosServiceClient, PhotosServiceDefinition as _photos_PhotosServiceDefinition } from './photos/PhotosService';
import type { UploadRequest as _photos_UploadRequest, UploadRequest__Output as _photos_UploadRequest__Output } from './photos/UploadRequest';
import type { UploadResponse as _photos_UploadResponse, UploadResponse__Output as _photos_UploadResponse__Output } from './photos/UploadResponse';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  photos: {
    DeleteRequest: MessageTypeDefinition<_photos_DeleteRequest, _photos_DeleteRequest__Output>
    DeleteResponse: MessageTypeDefinition<_photos_DeleteResponse, _photos_DeleteResponse__Output>
    PhotosService: SubtypeConstructor<typeof grpc.Client, _photos_PhotosServiceClient> & { service: _photos_PhotosServiceDefinition }
    UploadRequest: MessageTypeDefinition<_photos_UploadRequest, _photos_UploadRequest__Output>
    UploadResponse: MessageTypeDefinition<_photos_UploadResponse, _photos_UploadResponse__Output>
  }
}

