import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import { CreatePostDto } from './post.dto';
import { v4 as uuidv4 } from 'uuid';
import { ManagedTransaction } from 'neo4j-driver';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createPost(createPostDto: CreatePostDto): Promise<any> {
    const { content, authorId, tags = [] } = createPostDto;
    const postId = uuidv4();
    const createdAt = new Date().toISOString();

    // This operation (creating post, author relationship, tags, tag relationships)
    // should ideally be in a single transaction.
    return this.neo4jService.runInTransaction(
      async (tx: ManagedTransaction) => {
        // Create Post and :POSTED relationship
        const postResult = await tx.run(
          `
            MATCH (author:User {userId: $authorId})
            CREATE (post:Post {
            postId: $postId,
            content: $content,
            createdAt: datetime($createdAt)
            })
            CREATE (author)-[:POSTED]->(post)
            RETURN post.postId AS postId, post.content AS content, post.createdAt AS createdAt, author.username AS authorUsername
        `,
          { authorId, postId, content, createdAt },
        );

        if (postResult.records.length === 0) {
          // This could happen if authorId is invalid
          throw new NotFoundException(
            `Author with ID ${authorId} not found or post creation failed.`,
          );
        }
        const createdPost = postResult.records[0];
        const createdPostData: {
          postId: string;
          content: string;
          createdAt: string;
          authorUsername: string;
          tags: string[];
        } = {
          postId: createdPost.get('postId'),
          content: createdPost.get('content'),
          createdAt: createdPost.get('createdAt').toString(),
          authorUsername: createdPost.get('authorUsername'),
          tags: [],
        };

        // Handle Tags
        if (tags.length > 0) {
          for (const tagName of tags) {
            const tagResult = await tx.run(
              `
                    MATCH (p:Post {postId: $postId})
                    MERGE (t:Tag {name: $tagName}) // MERGE creates if not exists, matches if exists
                    MERGE (p)-[:HAS_TAG]->(t)
                    RETURN t.name AS tagName
                `,
              { postId, tagName: tagName.toLowerCase().trim() }, // Standardize tag names
            );
            if (tagResult.records.length > 0) {
              createdPostData.tags.push(tagResult.records[0].get('tagName'));
            }
          }
        }
        this.logger.log(
          `Post created: ${postId} by ${authorId} with tags: ${tags.join(', ')}`,
        );
        return createdPostData;
      },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  async findPostById(postId: string): Promise<any | null> {
    const query = `
      MATCH (p:Post {postId: $postId})<-[:POSTED]-(author:User)
      OPTIONAL MATCH (p)-[:HAS_TAG]->(t:Tag)
      RETURN p.postId AS postId, p.content AS content, p.createdAt AS createdAt,
             author.userId AS authorId, author.username AS authorUsername,
             collect(DISTINCT t.name) AS tags
    `;
    const result = await this.neo4jService.runReadQuery(query, { postId });
    if (result.records.length === 0) {
      return null;
    }
    const record = result.records[0];
    return {
      postId: record.get('postId'),
      content: record.get('content'),
      createdAt: record.get('createdAt').toString(),
      author: {
        userId: record.get('authorId'),
        username: record.get('authorUsername'),
      },
      tags: record.get('tags') || [],
    };
  }

  async likePost(userId: string, postId: string): Promise<void> {
    // Ensure user and post exist (simplified for brevity)
    const query = `
      MATCH (u:User {userId: $userId})
      MATCH (p:Post {postId: $postId})
      MERGE (u)-[r:LIKED]->(p)
      RETURN type(r)
    `;
    try {
      const result = await this.neo4jService.runWriteQuery(query, {
        userId,
        postId,
      });
      if (result.records.length > 0) {
        this.logger.log(`User ${userId} liked post ${postId}`);
      } else {
        this.logger.warn(
          `Like might not have been created for user ${userId} and post ${postId}. Check if user/post exist.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error liking post:`, error.stack);
      throw new Error(`Could not like post: ${error.message}`);
    }
  }

  async getLikesForPost(postId: string): Promise<any[]> {
    const query = `
        MATCH (u:User)-[:LIKED]->(p:Post {postId: $postId})
        RETURN u.userId AS userId, u.username AS username
    `;
    const result = await this.neo4jService.runReadQuery(query, { postId });
    return result.records.map((record) => ({
      userId: record.get('userId'),
      username: record.get('username'),
    }));
  }

  // Example Recommendation: Users who liked this post also liked...
  async getPostsLikedByLikersOfPost(
    postId: string,
    likerUserIdToExclude: string,
  ): Promise<any[]> {
    const query = `
        MATCH (targetPost:Post {postId: $postId})<-[:LIKED]-(liker:User)
        WHERE liker.userId <> $likerUserIdToExclude // Exclude the current user if needed
        MATCH (liker)-[:LIKED]->(otherPost:Post)
        WHERE otherPost <> targetPost // Don't recommend the same post
        WITH otherPost, otherPost.createdAt AS otherPostCreatedAt, count(DISTINCT liker) AS commonLikersCount // Carry createdAt forward
        MATCH (otherPostAuthor:User)-[:POSTED]->(otherPost)
        OPTIONAL MATCH (otherPost)-[:HAS_TAG]->(t:Tag)
        RETURN otherPost.postId AS postId, otherPost.content AS content,
              otherPostAuthor.username AS authorUsername,
              commonLikersCount,
              collect(DISTINCT t.name) AS tags,
              otherPostCreatedAt // Optionally return if needed, or just use for ORDER BY
        ORDER BY commonLikersCount DESC, otherPostCreatedAt DESC // Use the aliased variable
        LIMIT 10
    `;

    const result = await this.neo4jService.runReadQuery(query, {
      postId,
      likerUserIdToExclude,
    });
    return result.records.map((record) => ({
      postId: record.get('postId'),
      content: record.get('content'),
      authorUsername: record.get('authorUsername'),
      commonLikersCount: record.get('commonLikersCount').toNumber(), // Convert Neo4j Integer
      tags: record.get('tags'),
    }));
  }
}
