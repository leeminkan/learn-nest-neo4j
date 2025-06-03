import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
// Neo4jModule is global, UserModule might be imported if there are direct dependencies

@Module({
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
