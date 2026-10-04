import { Photo } from '../photo.entity';
import { PhotoInterface } from '../photo.interface';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { RpcException } from '@nestjs/microservices';
import { fileTypeFromBuffer } from 'file-type';

@Injectable()
export class LocalStorageService implements PhotoInterface {

  constructor(
    @InjectRepository(Photo)
    private readonly repo: Repository<Photo>,
  ) { }

  async validatePhoto(file: Buffer): Promise<void> {

    if (!file || file.length === 0) {
      throw new RpcException("File cannot be empty");
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB en bytes
    if (file.length > MAX_SIZE) {
      throw new RpcException(`File exceeds maximum size of 5MB`);
    }

    const type = await fileTypeFromBuffer(file);
    if (!type) {
      throw new RpcException("Could not determine file type");
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(type.mime)) {
      throw new RpcException(`Invalid file type: ${type.mime}. Only JPG, PNG and WEBP allowed`);
    }
  }

  async upload(file: Buffer): Promise<string> {
    await this.validatePhoto(file)
    const filename = `${uuidv4()}.jpg`;
    const fullPath = path.join('uploads', filename);

    await fs.writeFile(fullPath, file);

    const photo = this.repo.create({
      photoId: filename.replace('.jpg', ''),
      photoUrl: `http://localhost:3000/uploads/${filename}`,
    });
    await this.repo.save(photo);
    return photo.photoId;
  }

  async delete(photoId: string): Promise<boolean> {
    try {
      const photo = await this.repo.findOneBy({ photoId });
      if (!photo) return false;

      const filename = `${photoId}.jpg`;
      const fullPath = path.join('uploads', filename);
      await fs.unlink(fullPath);

      await this.repo.delete({ photoId });

      return true;
    } catch (error) {
      return false;
    }
  }

  async get(photoId: string): Promise<string> {
    const photo = await this.repo.findOneBy({ photoId });
    if (!photo) throw new Error('Photo not found');
    return photo.photoUrl;
  }
}