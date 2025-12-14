import { PhoneVerificationService } from "../phoneverification.service"
import { RedisService } from "../redis.service";
import { TwilioService } from "../twilio.service";
import { Test } from '@nestjs/testing';

describe ('PhoneVerificationService', () => {
    let service: PhoneVerificationService;

    // Redis mock
    const redisClientMock = {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
    };

    const redisServiceMock = {
        getClient: jest.fn().mockReturnValue(redisClientMock),
    };

    // Twilio mock
    const twilioServiceMock = {
        sendSms: jest.fn()
    };

    beforeEach(async () => {
        const moduleRef= await Test.createTestingModule({
            providers: [
                PhoneVerificationService,
                { provide: RedisService, useValue: redisServiceMock},
                { provide: TwilioService, useValue: twilioServiceMock},
            ],
        }).compile();

        service = moduleRef.get(PhoneVerificationService);
        jest.clearAllMocks();
    });

      it('should save otp on redis and send sms', async () => {
        await service.sendOtp('+573000000000');

        expect(redisClientMock.set).toHaveBeenCalledTimes(1);
        expect(twilioServiceMock.sendSms).toHaveBeenCalledTimes(1);
      });

    it('should return true if otp is valid', async () => {
        redisClientMock.get.mockResolvedValue('123456');

        const result = await service.verifyOtp('+573000000000', '123456');

        expect(result).toBe(true);
        expect(redisClientMock.del).toHaveBeenCalled();
    });

    it('should return false if otp is not valid', async () => {
        redisClientMock.get.mockResolvedValue('654321');

        const result = await service.verifyOtp('+573000000000', '123456');

        expect(result).toBe(false);
        expect(redisClientMock.del).not.toHaveBeenCalled();
    });

    it('should return false if otp does not exist', async () => {
        redisClientMock.get.mockResolvedValue(null);

        const result = await service.verifyOtp('+573000000000', '123456');

        expect(result).toBe(false);
    });

}
);