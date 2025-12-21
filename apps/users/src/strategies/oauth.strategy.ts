import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
    export class GoogleStrategy extends PassportStrategy(Strategy, 'google'){
        constructor() {
            super({
                clientID: process.env.GOOGLE_CLIENT_ID!,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                callbackURL: process.env.GOOGLE_CALLBACK_URL,
                scope: ['email', 'profile'],
                passReqToCallback: true,

            });
        }

        async validate(req: any, accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) {
            const { id, emails, displayName } = profile;

            const user = { provider: 'google', providerId: id, email: emails?.[0]?.value, name: displayName };
            done(null, user);
        }
    }