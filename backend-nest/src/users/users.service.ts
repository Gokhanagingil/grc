import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/**
 * Users Service
 * 
 * Provides business logic for user operations.
 * This is a skeleton implementation for the initial NestJS setup.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Get total count of users
   */
  async count(): Promise<number> {
    return this.usersRepository.count();
  }

  /**
   * Create a new user
   */
  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  /**
   * Find all users (with optional pagination)
   */
  async findAll(options?: { skip?: number; take?: number }): Promise<User[]> {
    return this.usersRepository.find({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }
}
