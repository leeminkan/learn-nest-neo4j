import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ValidationPipe,
  ParseUUIDPipe,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto, LikePostDto } from './post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async createPost(@Body(new ValidationPipe()) createPostDto: CreatePostDto) {
    try {
      return await this.postService.createPost(createPostDto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Could not create post',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findPost(@Param('id', ParseUUIDPipe) id: string) {
    const post = await this.postService.findPostById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }
    return post;
  }

  @Post('like')
  async likePost(@Body(new ValidationPipe()) likePostDto: LikePostDto) {
    try {
      await this.postService.likePost(likePostDto.userId, likePostDto.postId);
      return {
        message: `User ${likePostDto.userId} liked post ${likePostDto.postId}`,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Could not like post',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/likers')
  async getLikers(@Param('id', ParseUUIDPipe) id: string) {
    return this.postService.getLikesForPost(id);
  }

  @Get(':id/recommendations/:userIdToExclude') // userIdToExclude is the user for whom we are getting recommendations
  async getRecommendations(
    @Param('id', ParseUUIDPipe) postId: string,
    @Param('userIdToExclude', ParseUUIDPipe) userIdToExclude: string,
  ) {
    return this.postService.getPostsLikedByLikersOfPost(
      postId,
      userIdToExclude,
    );
  }
}
