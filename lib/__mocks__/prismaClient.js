// __mocks__/lib/prismaClient.js
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  detection: {
    findMany: jest.fn().mockResolvedValue([{ id: 1, name: "Detection Data" }]),
  },
  // ... any other models and methods
};

module.exports = mockPrismaClient;
