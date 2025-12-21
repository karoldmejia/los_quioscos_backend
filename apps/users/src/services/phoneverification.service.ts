import { Injectable } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { RedisService } from './redis.service';

@Injectable()
export class PhoneVerificationService {
  constructor(private readonly twilioService: TwilioService,
    private readonly redisService: RedisService,
  ) {}

  async sendOtp(phone: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redis = this.redisService.getClient();

    await redis.set(
        `otp:${phone}`,
        otp,
        'EX',
        300
    );

    await this.twilioService.sendSms(phone, `Your Los Quioscos verification code is: ${otp}`);
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const redis = this.redisService.getClient();
    const storedOtp = await redis.get(`otp:${phone}`);
    if (!storedOtp || storedOtp !== otp) return false;
    await redis.del(`otp:${phone}`);
    return true;
  }
}
