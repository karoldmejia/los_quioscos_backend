import { IsNotEmpty, IsNumber } from "class-validator";

export class UserDto {
  email: string;
  password: string;
  phone: string;
  otp: string;
  username: string; 
}

export class UploadProfilePhotoDto {
    @IsNumber()
    userId: string;

    @IsNotEmpty()
    photo: Buffer;
}
