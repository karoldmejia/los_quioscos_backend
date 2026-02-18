import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Pool } from 'pg';
import Redis from 'ioredis';

export let pgContainer: StartedTestContainer;
export let redisContainer: StartedTestContainer;
export let pgPool: Pool;
export let redisClient: Redis;

export async function setupContainers() {
  pgContainer = await new GenericContainer('postgres:latest')
    .withEnvironment({
      POSTGRES_USER: 'karold',
      POSTGRES_PASSWORD: 'mielpapalory',
      POSTGRES_DB: 'users_dev',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .start();

  const pgPort = pgContainer.getMappedPort(5432);

  pgPool = new Pool({
    host: pgContainer.getHost(),
    port: pgPort,
    user: 'karold',
    password: 'mielpapalory',
    database: 'users_dev',
  });

  // Redis
  redisContainer = await new GenericContainer('redis:latest')
    .withExposedPorts(6379)
    .start();

  const redisPort = redisContainer.getMappedPort(6379);
  redisClient = new Redis(redisPort, redisContainer.getHost());
}

export async function teardownContainers() {
  await pgPool?.end();
  await redisClient?.quit();
  await pgContainer?.stop();
  await redisContainer?.stop();
}