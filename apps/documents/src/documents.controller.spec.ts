import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let documentsController: DocumentsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [DocumentsService],
    }).compile();

    documentsController = app.get<DocumentsController>(DocumentsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(documentsController.getHello()).toBe('Hello World!');
    });
  });
});
