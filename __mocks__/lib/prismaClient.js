// __mocks__/lib/prismaClient.js
module.exports = {
    PrismaClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        user: {
            findMany: jest.fn().mockResolvedValue([{ id: 1, name: "John Doe" }])
        },
        // Add other methods and properties as needed
    }))
};
