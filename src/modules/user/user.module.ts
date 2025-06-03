import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
// Neo4jModule is global

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // Export if other modules need it
})
export class UserModule {}
