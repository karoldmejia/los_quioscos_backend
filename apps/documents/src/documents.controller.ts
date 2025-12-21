import { Controller, Get } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  getHello(): string {
    return this.documentsService.getHello();
  }
}
