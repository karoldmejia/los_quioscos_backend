// Original file: contracts/photos.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { DeleteRequest as _photos_DeleteRequest, DeleteRequest__Output as _photos_DeleteRequest__Output } from '../photos/DeleteRequest';
import type { DeleteResponse as _photos_DeleteResponse, DeleteResponse__Output as _photos_DeleteResponse__Output } from '../photos/DeleteResponse';
import type { UploadRequest as _photos_UploadRequest, UploadRequest__Output as _photos_UploadRequest__Output } from '../photos/UploadRequest';
import type { UploadResponse as _photos_UploadResponse, UploadResponse__Output as _photos_UploadResponse__Output } from '../photos/UploadResponse';

export interface PhotosServiceClient extends grpc.Client {
  Delete(argument: _photos_DeleteRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  Delete(argument: _photos_DeleteRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  Delete(argument: _photos_DeleteRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  Delete(argument: _photos_DeleteRequest, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  delete(argument: _photos_DeleteRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  delete(argument: _photos_DeleteRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  delete(argument: _photos_DeleteRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  delete(argument: _photos_DeleteRequest, callback: grpc.requestCallback<_photos_DeleteResponse__Output>): grpc.ClientUnaryCall;
  
  Upload(argument: _photos_UploadRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  Upload(argument: _photos_UploadRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  Upload(argument: _photos_UploadRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  Upload(argument: _photos_UploadRequest, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  upload(argument: _photos_UploadRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  upload(argument: _photos_UploadRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  upload(argument: _photos_UploadRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  upload(argument: _photos_UploadRequest, callback: grpc.requestCallback<_photos_UploadResponse__Output>): grpc.ClientUnaryCall;
  
}

export interface PhotosServiceHandlers extends grpc.UntypedServiceImplementation {
  Delete: grpc.handleUnaryCall<_photos_DeleteRequest__Output, _photos_DeleteResponse>;
  
  Upload: grpc.handleUnaryCall<_photos_UploadRequest__Output, _photos_UploadResponse>;
  
}

export interface PhotosServiceDefinition extends grpc.ServiceDefinition {
  Delete: MethodDefinition<_photos_DeleteRequest, _photos_DeleteResponse, _photos_DeleteRequest__Output, _photos_DeleteResponse__Output>
  Upload: MethodDefinition<_photos_UploadRequest, _photos_UploadResponse, _photos_UploadRequest__Output, _photos_UploadResponse__Output>
}
