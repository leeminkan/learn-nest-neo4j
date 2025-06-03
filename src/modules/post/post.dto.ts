import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID()
  authorId: string; // userId of the author

  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  @IsOptional()
  tags?: string[]; // Array of tag names
}

export class LikePostDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  postId: string;
}
