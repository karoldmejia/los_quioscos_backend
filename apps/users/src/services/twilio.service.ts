import { Injectable } from '@nestjs/common';
import Twilio from 'twilio';

@Injectable()
export class TwilioService {
  private client: Twilio.Twilio;

  constructor() {
    this.client = Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendSms(to: string, body: string) {
    return this.client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
      body,
    });
  }
}
