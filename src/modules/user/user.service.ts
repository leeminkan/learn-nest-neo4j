import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { CreateUserDto } from './user.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createUser(createUserDto: CreateUserDto): Promise<any> {
    const { username } = createUserDto;
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    // Check if username already exists
    const checkUserQuery = `
      MATCH (u:User {username: $username})
      RETURN u
    `;
    const existingUserResult = await this.neo4jService.runReadQuery(
      checkUserQuery,
      { username },
    );
    if (existingUserResult.records.length > 0) {
      throw new ConflictException(
        `User with username '${username}' already exists.`,
      );
    }

    const query = `
      CREATE (u:User {
        userId: $userId,
        username: $username,
        createdAt: datetime($createdAt)
      })
      RETURN u.userId AS userId, u.username AS username, u.createdAt AS createdAt
    `;
    try {
      const result = await this.neo4jService.runWriteQuery(query, {
        userId,
        username,
        createdAt,
      });
      if (result.records.length === 0) {
        throw new Error('User creation failed, no record returned.');
      }
      const record = result.records[0];
      this.logger.log(
        `User created: ${username} (ID: ${record.get('userId')})`,
      );
      return {
        userId: record.get('userId'),
        username: record.get('username'),
        createdAt: record.get('createdAt').toString(), // Convert Neo4j DateTime to string
      };
    } catch (error) {
      this.logger.error(`Error creating user ${username}:`, error.stack);
      throw new Error(`Could not create user: ${error.message}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  async findUserById(userId: string): Promise<any | null> {
    const query = `
      MATCH (u:User {userId: $userId})
      RETURN u.userId AS userId, u.username AS username, u.createdAt AS createdAt
    `;
    const result = await this.neo4jService.runReadQuery(query, { userId });
    if (result.records.length === 0) {
      return null;
    }
    const record = result.records[0];
    return {
      userId: record.get('userId'),
      username: record.get('username'),
      createdAt: record.get('createdAt').toString(),
    };
  }

  async followUser(followerId: string, followedId: string): Promise<void> {
    // Ensure both users exist (simplified check for brevity)
    if (
      !(await this.findUserById(followerId)) ||
      !(await this.findUserById(followedId))
    ) {
      throw new NotFoundException('One or both users not found.');
    }
    if (followerId === followedId) {
      throw new Error('User cannot follow themselves.');
    }

    const query = `
      MATCH (follower:User {userId: $followerId})
      MATCH (followed:User {userId: $followedId})
      MERGE (follower)-[r:FOLLOWS]->(followed)
      RETURN type(r) AS relationshipType
    `;
    try {
      const result = await this.neo4jService.runWriteQuery(query, {
        followerId,
        followedId,
      });
      if (result.records.length > 0) {
        this.logger.log(`User ${followerId} now follows ${followedId}`);
      } else {
        this.logger.warn(
          `Follow relationship might not have been created between ${followerId} and ${followedId}. Check MERGE logic if this is unexpected.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error creating follow relationship:`, error.stack);
      throw new Error(`Could not follow user: ${error.message}`);
    }
  }

  async getFollowers(userId: string): Promise<any[]> {
    const query = `
      MATCH (follower:User)-[:FOLLOWS]->(targetUser:User {userId: $userId})
      RETURN follower.userId AS userId, follower.username AS username
    `;
    const result = await this.neo4jService.runReadQuery(query, { userId });
    return result.records.map((record) => ({
      userId: record.get('userId'),
      username: record.get('username'),
    }));
  }

  async getFollowing(userId: string): Promise<any[]> {
    const query = `
      MATCH (targetUser:User {userId: $userId})-[:FOLLOWS]->(followed:User)
      RETURN followed.userId AS userId, followed.username AS username
    `;
    const result = await this.neo4jService.runReadQuery(query, { userId });
    return result.records.map((record) => ({
      userId: record.get('userId'),
      username: record.get('username'),
    }));
  }
}
