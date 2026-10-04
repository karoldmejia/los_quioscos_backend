import { Controller, Get, HttpException, HttpStatus, Param } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LocalStorageService } from './services/localStorage.service';

@Controller()
export class PhotoController {
  constructor(private readonly photosService: LocalStorageService) { }

  @GrpcMethod('PhotosService', 'Upload')
  async upload(data: { file: Buffer }): Promise<{ photoId: string }> {
    const photoId = await this.photosService.upload(data.file);
    return { photoId };
  }

  @GrpcMethod('PhotosService', 'Delete')
  async delete(data: { photoId: string }): Promise<{ success: boolean }> {
    const success = await this.photosService.delete(data.photoId);
    return { success };
  }

  @GrpcMethod('PhotosService', 'Get')
  async get(data: { photoId: string }): Promise<{ url: string }> {
    const url = await this.photosService.get(data.photoId);
    return { url };
  }

  @Get(':photoId')
  async getPhoto(@Param('photoId') photoId: string) {
    try {
      const url = await this.photosService.get(photoId);
      return { url };
    } catch (error) {
      throw new HttpException('Photo not found', HttpStatus.NOT_FOUND);
    }
  }
}