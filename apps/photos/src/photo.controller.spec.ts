jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockResolvedValue({ mime: 'image/jpeg' }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PhotoController } from './photo.controller';
import { LocalStorageService } from './services/localStorage.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

const mockLocalStorageService = {
  upload: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
  validatePhoto: jest.fn(),
};

describe('PhotoController', () => {
  let controller: PhotoController;
  let service: LocalStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotoController],
      providers: [
        {
          provide: LocalStorageService,
          useValue: mockLocalStorageService,
        },
      ],
    }).compile();

    controller = module.get<PhotoController>(PhotoController);
    service = module.get<LocalStorageService>(LocalStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload a file and return photoId', async () => {
      // Arrange
      const mockFile = Buffer.from('mock image data');
      const expectedPhotoId = '123e4567-e89b-12d3-a456-426614174000';
      mockLocalStorageService.upload.mockResolvedValue(expectedPhotoId);

      // Act
      const result = await controller.upload({ file: mockFile });

      // Assert
      expect(mockLocalStorageService.upload).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual({ photoId: expectedPhotoId });
    });

    it('should throw RpcException when upload fails', async () => {
      // Arrange
      const mockFile = Buffer.from('mock image data');
      const error = new RpcException('Upload failed');
      mockLocalStorageService.upload.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.upload({ file: mockFile }))
        .rejects
        .toThrow(RpcException);
      expect(mockLocalStorageService.upload).toHaveBeenCalledWith(mockFile);
    });

    it('should handle empty file', async () => {
      // Arrange
      const emptyFile = Buffer.from('');
      const error = new RpcException('File cannot be empty');
      mockLocalStorageService.upload.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.upload({ file: emptyFile }))
        .rejects
        .toThrow(RpcException);
      expect(mockLocalStorageService.upload).toHaveBeenCalledWith(emptyFile);
    });
  });

  describe('delete', () => {
    it('should delete a photo and return success true', async () => {
      // Arrange
      const photoId = '123e4567-e89b-12d3-a456-426614174000';
      mockLocalStorageService.delete.mockResolvedValue(true);

      // Act
      const result = await controller.delete({ photoId });

      // Assert
      expect(mockLocalStorageService.delete).toHaveBeenCalledWith(photoId);
      expect(result).toEqual({ success: true });
    });

    it('should return success false when photo not found', async () => {
      // Arrange
      const photoId = 'non-existent-id';
      mockLocalStorageService.delete.mockResolvedValue(false);

      // Act
      const result = await controller.delete({ photoId });

      // Assert
      expect(mockLocalStorageService.delete).toHaveBeenCalledWith(photoId);
      expect(result).toEqual({ success: false });
    });

    it('should throw RpcException when delete fails', async () => {
      // Arrange
      const photoId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new RpcException('Database error');
      mockLocalStorageService.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.delete({ photoId }))
        .rejects
        .toThrow(RpcException);
      expect(mockLocalStorageService.delete).toHaveBeenCalledWith(photoId);
    });
  });

  describe('get', () => {
    it('should get a photo and return its URL', async () => {
      // Arrange
      const photoId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedUrl = 'http://localhost:3000/uploads/photo.jpg';
      mockLocalStorageService.get.mockResolvedValue(expectedUrl);

      // Act
      const result = await controller.get({ photoId });

      // Assert
      expect(mockLocalStorageService.get).toHaveBeenCalledWith(photoId);
      expect(result).toEqual({ url: expectedUrl });
    });

    it('should throw RpcException when photo not found', async () => {
      // Arrange
      const photoId = 'non-existent-id';
      const error = new RpcException('Photo not found');
      mockLocalStorageService.get.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.get({ photoId }))
        .rejects
        .toThrow(RpcException);
      expect(mockLocalStorageService.get).toHaveBeenCalledWith(photoId);
    });
  });

  describe('getPhoto (HTTP endpoint)', () => {
    it('should return photo URL for valid photoId', async () => {
      // Arrange
      const photoId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedUrl = 'http://localhost:3000/uploads/photo.jpg';
      mockLocalStorageService.get.mockResolvedValue(expectedUrl);

      // Act
      const result = await controller.getPhoto(photoId);

      // Assert
      expect(mockLocalStorageService.get).toHaveBeenCalledWith(photoId);
      expect(result).toEqual({ url: expectedUrl });
    });

    it('should throw HttpException 404 when photo not found', async () => {
      // Arrange
      const photoId = 'non-existent-id';
      const error = new Error('Photo not found');
      mockLocalStorageService.get.mockRejectedValue(error);

      // Act & Assert
      try {
        await controller.getPhoto(photoId);
        fail('Expected HttpException but no exception was thrown');
      } catch (error) {
        if (error instanceof HttpException) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Photo not found');
          expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        } else {
          fail('Expected HttpException but got different error');
        }
      }
      expect(mockLocalStorageService.get).toHaveBeenCalledWith(photoId);
    });

    it('should handle other errors and return 404', async () => {
      // Arrange
      const photoId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Database connection failed');
      mockLocalStorageService.get.mockRejectedValue(error);

      // Act & Assert
      try {
        await controller.getPhoto(photoId);
        fail('Expected HttpException but no exception was thrown');
      } catch (error) {
        if (error instanceof HttpException) {
          expect(error).toBeInstanceOf(HttpException);
          expect(error.message).toBe('Photo not found');
          expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        } else {
          fail('Expected HttpException but got different error');
        }
      }
    });
  });
});