import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class UserDto {
  email: string;
  password: string;
  phone: string;
  otp: string;
  username: string; 
}

export class UploadProfilePhotoDto {
    @IsString()
    userId: string;

    @IsNotEmpty()
    photo: Buffer;
}
