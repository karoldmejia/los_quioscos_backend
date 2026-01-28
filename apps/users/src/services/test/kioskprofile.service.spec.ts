import { Test } from '@nestjs/testing';
import { KioskProfileService } from '../kioskprofile.service';
import { KioskProfileRepository } from '../../repositories/impl/kioskprofile.repository';
import { DocumentsValidationService } from '../documents-validation.service'; // ← Importar correcto
import { KioskProfileDto } from '../../dtos/kioskprofile.dto';
import { DocumentStatus } from '../../entities/document_status.enum';
import { RpcException } from '@nestjs/microservices';

describe('KioskProfileService', () => {
  let service: KioskProfileService;

  const repoMock = {
    create: jest.fn(),
    update: jest.fn(),
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    findActiveProfiles: jest.fn(),
    findProfilesReadyToOperate: jest.fn(),
    findProfilesWithPendingDocuments: jest.fn(),
    findByKioskName: jest.fn(),
    findByFullLegalName: jest.fn(),
  };

  const documentsValidationMock = {
    validateDocument: jest.fn(),
  };

  const validDto: KioskProfileDto = {
    userId: 1,
    fullLegalName: 'Juan Perez',
    idNumber: '1234567890',
    kioskName: 'Kiosko 1',
    kioskDescr: 'Descripcion',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        KioskProfileService,
        { provide: KioskProfileRepository, useValue: repoMock },
        { provide: DocumentsValidationService, useValue: documentsValidationMock },
      ],
    }).compile();

    service = moduleRef.get(KioskProfileService);
    jest.clearAllMocks();
  });

  // create
  describe('create', () => {
    it('should create profile correctly', async () => {
      const createdProfile = { ...validDto, documentsStatus: { ID: DocumentStatus.PENDING } };
      repoMock.create.mockResolvedValue(createdProfile);

      const result = await service.create(validDto);

      expect(repoMock.create).toHaveBeenCalledWith({
        userId: validDto.userId,
        fullLegalName: validDto.fullLegalName,
        idNumber: validDto.idNumber,
        kioskName: validDto.kioskName,
        kioskDescr: validDto.kioskDescr,
        documentsStatus: { ID: DocumentStatus.PENDING },
        declarationSignedAt: undefined,
      });

      expect(result).toEqual(createdProfile);
    });
  });

  // updateProfile
  describe('updateProfile', () => {
    const existingProfile = { 
      userId: 1, 
      fullLegalName: 'Juan Perez',
      idNumber: '1234567890',
      kioskName: 'Kiosko Viejo',
      kioskDescr: 'Descripcion',
      documentsStatus: { ID: DocumentStatus.PENDING }
    };

    beforeEach(() => {
      repoMock.findByUserId.mockResolvedValue(existingProfile);
      repoMock.update.mockImplementation((profile) => Promise.resolve(profile));
    });

    it('should throw if profile not found', async () => {
      repoMock.findByUserId.mockResolvedValue(null);

      await expect(service.updateProfile(1, validDto))
        .rejects.toThrow(RpcException);
    });

    it('should update only provided fields', async () => {
      repoMock.findByKioskName.mockResolvedValue(null);
      repoMock.findByFullLegalName.mockResolvedValue(null);

      const result = await service.updateProfile(1, { kioskName: 'Nuevo Kiosko' } as any);

      expect(repoMock.update).toHaveBeenCalledWith(expect.objectContaining({ kioskName: 'Nuevo Kiosko' }));
      expect(result.kioskName).toBe('Nuevo Kiosko');
    });

    it('should validate ID number length', async () => {
      await expect(service.updateProfile(1, { idNumber: '123' } as any))
        .rejects.toThrow('ID number must have between 7 and 10 digits');
    });

    it('should validate kiosk name uniqueness', async () => {
      repoMock.findByKioskName.mockResolvedValue({ userId: 2, kioskName: 'Kiosko Existente' });
      
      await expect(service.updateProfile(1, { kioskName: 'Kiosko Existente' } as any))
        .rejects.toThrow('Kiosk name is already taken');
    });

    it('should allow same kiosk name for same user', async () => {
      repoMock.findByKioskName.mockResolvedValue({ userId: 1, kioskName: 'Mi Kiosko' });
      
      const result = await service.updateProfile(1, { kioskName: 'Mi Kiosko' } as any);
      
      expect(result.kioskName).toBe('Mi Kiosko');
      expect(repoMock.update).toHaveBeenCalled();
    });
  });

  // getProfileByUserId
  describe('getProfileByUserId', () => {
    it('should throw if profile not found', async () => {
      repoMock.findByUserId.mockResolvedValue(null);
      await expect(service.getProfileByUserId(1))
        .rejects.toThrow(RpcException);
    });

    it('should return profile if found', async () => {
      const profile = { ...validDto };
      repoMock.findByUserId.mockResolvedValue(profile);

      const result = await service.getProfileByUserId(1);
      expect(result).toEqual(profile);
    });
  });

  // getters
  it('should call findAll', async () => {
    repoMock.findAll.mockResolvedValue([]);
    await service.getAllProfiles();
    expect(repoMock.findAll).toHaveBeenCalled();
  });

  it('should call findActiveProfiles', async () => {
    repoMock.findActiveProfiles.mockResolvedValue([]);
    await service.getActiveProfiles();
    expect(repoMock.findActiveProfiles).toHaveBeenCalled();
  });

  it('should call findProfilesReadyToOperate', async () => {
    repoMock.findProfilesReadyToOperate.mockResolvedValue([]);
    await service.getProfilesReadyToOperate();
    expect(repoMock.findProfilesReadyToOperate).toHaveBeenCalled();
  });

  it('should call findProfilesWithPendingDocuments', async () => {
    repoMock.findProfilesWithPendingDocuments.mockResolvedValue([]);
    await service.getProfilesWithPendingDocuments();
    expect(repoMock.findProfilesWithPendingDocuments).toHaveBeenCalled();
  });

  // uploadIdDocument
  describe('uploadIdDocument', () => {
    const file = Buffer.from('file');

    it('should call validateDocument with priority 1 then 2 if first fails', async () => {
      const profile = { ...validDto, documentsStatus: { ID: DocumentStatus.PENDING }, declarationSignedAt: null, canOperate: false };
      repoMock.findByUserId.mockResolvedValue(profile);

      documentsValidationMock.validateDocument
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ is_valid: true });

      repoMock.update.mockResolvedValue({ ...profile, documentsStatus: { ID: DocumentStatus.VALID } });

      const result = await service.uploadIdDocument(1, file);

      expect(documentsValidationMock.validateDocument).toHaveBeenCalledTimes(2);
      expect(result.profile.documentsStatus.ID).toBe(DocumentStatus.VALID);
    });

    it('should mark document as REJECTED if both fail', async () => {
      const profile = { ...validDto, documentsStatus: { ID: DocumentStatus.PENDING }, declarationSignedAt: null, canOperate: false };
      repoMock.findByUserId.mockResolvedValue(profile);

      documentsValidationMock.validateDocument.mockRejectedValue(new Error('fail')); // ← Cambiado

      repoMock.update.mockResolvedValue({ ...profile, documentsStatus: { ID: DocumentStatus.REJECTED } });

      const result = await service.uploadIdDocument(1, file);

      expect(result.profile.documentsStatus.ID).toBe(DocumentStatus.REJECTED);
    });
  });

  // signDeclaration
  describe('signDeclaration', () => {
    it('should throw if profile not found', async () => {
      repoMock.findByUserId.mockResolvedValue(null);
      await expect(service.signDeclaration(1))
        .rejects.toThrow(RpcException);
    });

    it('should set declarationSignedAt and recalc canOperate', async () => {
      const profile = { 
        ...validDto, 
        documentsStatus: { ID: DocumentStatus.VALID }, 
        declarationSignedAt: null, 
        canOperate: false 
      };
      repoMock.findByUserId.mockResolvedValue(profile);
      repoMock.update.mockImplementation(async (p) => p);

      const result = await service.signDeclaration(1);

      expect(result.declarationSignedAt).toBeDefined();
      expect(result.canOperate).toBe(true);
    });

    it('should not set canOperate if documents not valid', async () => {
      const profile = { 
        ...validDto, 
        documentsStatus: { ID: DocumentStatus.PENDING },
        declarationSignedAt: null, 
        canOperate: false 
      };
      repoMock.findByUserId.mockResolvedValue(profile);
      repoMock.update.mockImplementation(async (p) => p);

      const result = await service.signDeclaration(1);

      expect(result.declarationSignedAt).toBeDefined();
      expect(result.canOperate).toBe(false);
    });
  });
});