import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  Logger,
} from '@nestjs/common';
import neo4j, {
  Driver,
  Session,
  Result,
  ManagedTransaction,
} from 'neo4j-driver';
import { ConfigType } from '@nestjs/config';
import neo4jConfig from '../../configs/neo4j.config';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver;

  constructor(
    @Inject(neo4jConfig.KEY)
    private readonly config: ConfigType<typeof neo4jConfig>,
  ) {}

  async onModuleInit() {
    try {
      if (!this.config.uri) {
        throw new Error('Neo4j URI is not defined in the configuration.');
      }
      if (!this.config.username || !this.config.password) {
        throw new Error(
          'Neo4j username or password is not defined in the configuration.',
        );
      }

      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
      );
      await this.driver.verifyConnectivity();
      this.logger.log('Successfully connected to Neo4j database.');
    } catch (error) {
      this.logger.error('Failed to connect to Neo4j database.', error.stack);
      throw error; // Propagate error to stop application bootstrap if connection fails
    }
  }

  async onModuleDestroy() {
    if (this.driver) {
      await this.driver.close();
      this.logger.log('Neo4j driver connection closed.');
    }
  }

  // Use this to get a session for read operations
  getReadSession(database?: string): Session {
    return this.driver.session({
      database: database || this.config.database,
      defaultAccessMode: neo4j.session.READ,
    });
  }

  // Use this to get a session for write operations
  getWriteSession(database?: string): Session {
    return this.driver.session({
      database: database || this.config.database,
      defaultAccessMode: neo4j.session.WRITE,
    });
  }

  // Example helper to run a read query
  async runReadQuery(
    query: string,
    params?: Record<string, any>,
    database?: string,
  ): Promise<Result> {
    const session = this.getReadSession(database);
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  // Example helper to run a write query
  async runWriteQuery(
    query: string,
    params?: Record<string, any>,
    database?: string,
  ): Promise<Result> {
    const session = this.getWriteSession(database);
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  // Helper for transactions (more advanced, showing the pattern)
  async runInTransaction<T>(
    work: (tx: ManagedTransaction) => Promise<T>,
    database?: string,
  ): Promise<T> {
    const session = this.getWriteSession(database);
    let result: T;
    try {
      result = await session.executeWrite(async (tx) => {
        return await work(tx);
      });
    } finally {
      await session.close();
    }
    return result;
  }
}
