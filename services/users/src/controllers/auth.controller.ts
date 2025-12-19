import { Controller, Post, Body, UseGuards, Get, Req, UnauthorizedException } from "@nestjs/common";
import { AuthDto } from "../dtos/auth.dto";
import { AuthService } from "src/services/auth.service";
import { AuthGuard } from "@nestjs/passport";

@Controller('auth')
export class AuthController{
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() dto: AuthDto) {
        const user = await this.authService.validateUser(dto);
        if (!user) {
        throw new UnauthorizedException('Invalid credentials'); 
        }
        return this.authService.login(user);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req) {
        const token = await this.authService.validateOAuthUser(req.user);
        return { access_token: token.access_token };
    }

}