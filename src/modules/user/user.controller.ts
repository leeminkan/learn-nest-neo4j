import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ValidationPipe,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body(new ValidationPipe()) createUserDto: CreateUserDto) {
    try {
      return await this.userService.createUser(createUserDto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Could not create user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userService.findUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Post(':followerId/follow/:followedId')
  async follow(
    @Param('followerId', ParseUUIDPipe) followerId: string,
    @Param('followedId', ParseUUIDPipe) followedId: string,
  ) {
    try {
      await this.userService.followUser(followerId, followedId);
      return {
        message: `User ${followerId} successfully followed ${followedId}`,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Could not follow user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/followers')
  async getFollowers(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getFollowers(id);
  }

  @Get(':id/following')
  async getFollowing(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getFollowing(id);
  }
}
