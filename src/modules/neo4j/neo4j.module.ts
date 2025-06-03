import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Neo4jService } from './neo4j.service';
import neo4jConfig from '../../configs/neo4j.config';

@Global() // Make Neo4jService available globally
@Module({
  imports: [ConfigModule.forFeature(neo4jConfig)],
  providers: [Neo4jService],
  exports: [Neo4jService],
})
export class Neo4jModule {}
