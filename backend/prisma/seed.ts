import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@llmgateway.com' },
    update: {},
    create: {
      email: 'admin@llmgateway.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('Admin user created:', admin.email);

  // Create sample client
  const clientPassword = await bcrypt.hash('client123456', 10);
  const client = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      passwordHash: clientPassword,
      role: 'CLIENT',
    },
  });
  console.log('Client user created:', client.email);

  // Create sample methods
  const method1 = await prisma.method.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Text Summarizer',
      description:
        'Summarizes input text into a concise summary',
      inputType: 'TEXT',
      promptTemplate:
        'You are an expert text summarizer. Analyze the following text and provide a clear, concise summary that captures the key points and main ideas.',
      provider: 'OPENAI',
      model: 'gpt-4o',
      isPublic: true,
      isActive: true,
      config: { temperature: 0.3, maxTokens: 1024 },
    },
  });

  const method2 = await prisma.method.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Sentiment Analyzer',
      description: 'Analyzes the sentiment of input text',
      inputType: 'TEXT',
      promptTemplate:
        'You are a sentiment analysis expert. Analyze the sentiment of the following text. Determine if it is positive, negative, or neutral. Provide a confidence score and key phrases that influenced your decision.',
      provider: 'ANTHROPIC',
      model: 'claude-sonnet-4-6',
      isPublic: false,
      isActive: true,
      config: { temperature: 0.1, maxTokens: 512 },
    },
  });

  const method3 = await prisma.method.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Data Extractor',
      description:
        'Extracts structured data from unstructured text input',
      inputType: 'JSON_SCHEMA',
      promptTemplate:
        'You are a data extraction specialist. Extract the requested information from the provided data and return it in the specified format.',
      provider: 'GOOGLE',
      model: 'gemini-2.0-flash',
      isPublic: true,
      isActive: true,
      config: { temperature: 0.2, maxTokens: 2048 },
    },
  });

  console.log(
    'Sample methods created:',
    method1.name,
    method2.name,
    method3.name,
  );

  // Assign method2 (private) to client
  await prisma.userMethod.upsert({
    where: {
      userId_methodId: { userId: client.id, methodId: method2.id },
    },
    update: {},
    create: {
      userId: client.id,
      methodId: method2.id,
      outputSchemaOverride: {
        sentiment: 'positive | negative | neutral',
        confidence: 0.0,
        keyPhrases: ['phrase1', 'phrase2'],
      },
      isActive: true,
    },
  });

  console.log('Method assigned to client with output schema');
  console.log('\nSeed complete!');
  console.log('Admin: admin@llmgateway.com / admin123456');
  console.log('Client: client@example.com / client123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
